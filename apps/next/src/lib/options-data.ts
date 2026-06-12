import type { OptionChainResponse, OptionContract, OptionsDataProvider } from "./types";

type CacheEntry = {
  expiresAt: number;
  data: OptionChainResponse;
};

const OPTIONS_CACHE_MS = 45_000;
const REQUEST_TIMEOUT_MS = 8_000;
const cache = new Map<string, CacheEntry>();

function nowIso() {
  return new Date().toISOString();
}

function cleanTicker(ticker: string | null | undefined) {
  return (ticker || "SPY").replace(/[^A-Za-z.]/g, "").toUpperCase().slice(0, 12) || "SPY";
}

function getConfiguredProvider(): OptionsDataProvider | "invalid" {
  const provider = (process.env.OPTIONS_DATA_PROVIDER || "").trim().toLowerCase();
  if (!provider) return "none";
  if (provider === "fmp" || provider === "polygon") return provider;
  return "invalid";
}

function errorResponse(
  ticker: string,
  provider: OptionsDataProvider,
  message: string,
  errorCode: NonNullable<OptionChainResponse["errorCode"]>
): OptionChainResponse {
  return {
    ticker,
    underlyingPrice: null,
    provider,
    updatedAt: nowIso(),
    contracts: [],
    message,
    errorCode
  };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(String(value).replace("%", ""));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getField(record: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (record[name] !== undefined) return record[name];
  }
  return undefined;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 45 }
    });
    if (!response.ok) {
      throw new Error(`Provider HTTP ${response.status}`);
    }
    return response.json() as Promise<unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function daysToExpiration(expiry: string) {
  const expiryDate = new Date(`${expiry}T21:00:00Z`).getTime();
  if (!Number.isFinite(expiryDate)) return 0;
  return Math.max(0, Math.ceil((expiryDate - Date.now()) / 86_400_000));
}

function normalizeIv(value: unknown) {
  const numberValue = toNumber(value);
  if (numberValue === null) return null;
  return numberValue > 3 ? numberValue / 100 : numberValue;
}

function inferType(record: Record<string, unknown>, symbol: string): "CALL" | "PUT" | null {
  const raw = String(getField(record, ["type", "optionType", "contractType", "contract_type", "putCall"]) || "").toUpperCase();
  if (raw.includes("CALL") || raw === "C") return "CALL";
  if (raw.includes("PUT") || raw === "P") return "PUT";
  const compactSymbol = symbol.replace(/\s+/g, "");
  if (/[CP]\d{8,}$/.test(compactSymbol)) return compactSymbol.match(/C\d{8,}$/) ? "CALL" : "PUT";
  const osiMatch = compactSymbol.match(/\d{6}([CP])\d{8}$/);
  if (osiMatch?.[1] === "C") return "CALL";
  if (osiMatch?.[1] === "P") return "PUT";
  return null;
}

function calculateSpreadPct(bid: number | null, ask: number | null, mid: number | null) {
  if (bid === null || ask === null || mid === null || mid <= 0) return null;
  return ((ask - bid) / mid) * 100;
}

function calculateQualityScore(contract: Omit<OptionContract, "qualityScore">) {
  let score = 100;

  if (contract.spreadPct === null) score -= 18;
  else if (contract.spreadPct <= 5) score += 0;
  else if (contract.spreadPct <= 15) score -= 8;
  else if (contract.spreadPct <= 30) score -= 22;
  else score -= 38;

  const volume = contract.volume ?? 0;
  if (volume >= 1000) score += 0;
  else if (volume >= 500) score -= 4;
  else if (volume >= 100) score -= 10;
  else score -= 24;

  const openInterest = contract.openInterest ?? 0;
  if (openInterest >= 1000) score += 0;
  else if (openInterest >= 500) score -= 4;
  else if (openInterest >= 100) score -= 10;
  else score -= 22;

  const delta = contract.delta;
  const idealDelta =
    contract.type === "CALL"
      ? delta !== null && delta >= 0.25 && delta <= 0.6
      : delta !== null && delta >= -0.6 && delta <= -0.25;
  if (!idealDelta) score -= delta === null ? 10 : 18;

  if (contract.dte === 0) score -= 8;
  else if (contract.dte <= 7) score += 0;
  else if (contract.dte <= 21) score -= 8;
  else score -= 18;

  if (contract.iv !== null) {
    if (contract.iv > 1.2) score -= 22;
    else if (contract.iv > 0.8) score -= 12;
    else if (contract.iv > 0.55) score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildContract(input: {
  symbol: string;
  type: "CALL" | "PUT";
  expiry: string;
  strike: number | null;
  bid: number | null;
  ask: number | null;
  last: number | null;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  volume: number | null;
  openInterest: number | null;
}): OptionContract | null {
  if (!input.symbol || !input.expiry || input.strike === null) return null;
  const mid = input.bid !== null && input.ask !== null ? (input.bid + input.ask) / 2 : input.last;
  const contractWithoutScore = {
    symbol: input.symbol,
    type: input.type,
    expiry: input.expiry,
    dte: daysToExpiration(input.expiry),
    strike: input.strike,
    bid: input.bid,
    ask: input.ask,
    mid,
    last: input.last,
    iv: input.iv,
    delta: input.delta,
    gamma: input.gamma,
    theta: input.theta,
    vega: input.vega,
    volume: input.volume,
    openInterest: input.openInterest,
    spreadPct: calculateSpreadPct(input.bid, input.ask, mid)
  };
  return {
    ...contractWithoutScore,
    qualityScore: calculateQualityScore(contractWithoutScore)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectRecords(value: unknown, output: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRecords(item, output);
    return output;
  }
  if (!isRecord(value)) return output;

  const hasStrike = getField(value, ["strike", "strikePrice", "strike_price"]) !== undefined;
  const hasExpiry = getField(value, ["expiry", "expiration", "expirationDate", "expiration_date", "date"]) !== undefined;
  if (hasStrike && hasExpiry) output.push(value);

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) collectRecords(child, output);
  }
  return output;
}

function normalizeFmpContract(record: Record<string, unknown>): OptionContract | null {
  const symbol = String(getField(record, ["symbol", "optionSymbol", "contractSymbol", "ticker"]) || "");
  const type = inferType(record, symbol);
  if (!type) return null;
  return buildContract({
    symbol,
    type,
    expiry: String(getField(record, ["expiry", "expiration", "expirationDate", "expiration_date", "date"]) || "").slice(0, 10),
    strike: toNumber(getField(record, ["strike", "strikePrice", "strike_price"])),
    bid: toNumber(getField(record, ["bid", "bidPrice"])),
    ask: toNumber(getField(record, ["ask", "askPrice"])),
    last: toNumber(getField(record, ["last", "lastPrice", "price"])),
    iv: normalizeIv(getField(record, ["iv", "impliedVolatility", "implied_volatility"])),
    delta: toNumber(getField(record, ["delta"])),
    gamma: toNumber(getField(record, ["gamma"])),
    theta: toNumber(getField(record, ["theta"])),
    vega: toNumber(getField(record, ["vega"])),
    volume: toNumber(getField(record, ["volume"])),
    openInterest: toNumber(getField(record, ["openInterest", "open_interest"]))
  });
}

async function fetchFmpOptionChain(ticker: string, apiKey: string): Promise<OptionChainResponse> {
  const urls = [
    `https://financialmodelingprep.com/stable/options-chain?symbol=${ticker}&apikey=${apiKey}`,
    `https://financialmodelingprep.com/api/v3/options-chain/${ticker}?apikey=${apiKey}`
  ];
  let payload: unknown = null;
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      payload = await fetchJson(url);
      const records = collectRecords(payload);
      if (records.length > 0) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("FMP provider error");
    }
  }

  if (payload === null && lastError) throw lastError;

  const records = collectRecords(payload);
  const contracts = records
    .map(normalizeFmpContract)
    .filter((contract): contract is OptionContract => Boolean(contract))
    .sort((a, b) => b.qualityScore - a.qualityScore);
  const quotePayload = await fetchJson(`https://financialmodelingprep.com/stable/quote?symbol=${ticker}&apikey=${apiKey}`).catch(() => null);
  const quote = Array.isArray(quotePayload) && isRecord(quotePayload[0]) ? quotePayload[0] : null;

  return {
    ticker,
    underlyingPrice: quote ? toNumber(getField(quote, ["price", "last", "previousClose"])) : null,
    provider: "fmp",
    updatedAt: nowIso(),
    contracts
  };
}

function normalizePolygonContract(record: Record<string, unknown>): OptionContract | null {
  const details = isRecord(record.details) ? record.details : {};
  const greeks = isRecord(record.greeks) ? record.greeks : {};
  const quote = isRecord(record.last_quote) ? record.last_quote : {};
  const trade = isRecord(record.last_trade) ? record.last_trade : {};
  const day = isRecord(record.day) ? record.day : {};
  const symbol = String(getField(details, ["ticker"]) || getField(record, ["ticker"]) || "");
  const type = inferType({ ...record, ...details }, symbol);
  if (!type) return null;

  return buildContract({
    symbol,
    type,
    expiry: String(getField(details, ["expiration_date"]) || "").slice(0, 10),
    strike: toNumber(getField(details, ["strike_price"])),
    bid: toNumber(getField(quote, ["bid", "bid_price", "bp"])),
    ask: toNumber(getField(quote, ["ask", "ask_price", "ap"])),
    last: toNumber(getField(trade, ["price", "p"]) ?? getField(day, ["close"])),
    iv: normalizeIv(getField(record, ["implied_volatility"])),
    delta: toNumber(getField(greeks, ["delta"])),
    gamma: toNumber(getField(greeks, ["gamma"])),
    theta: toNumber(getField(greeks, ["theta"])),
    vega: toNumber(getField(greeks, ["vega"])),
    volume: toNumber(getField(day, ["volume"])),
    openInterest: toNumber(getField(record, ["open_interest"]))
  });
}

async function fetchPolygonOptionChain(ticker: string, apiKey: string): Promise<OptionChainResponse> {
  const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=250&apiKey=${apiKey}`;
  const payload = await fetchJson(url);
  const root = isRecord(payload) ? payload : {};
  const results = Array.isArray(root.results) ? root.results : [];
  const contracts = results
    .filter(isRecord)
    .map(normalizePolygonContract)
    .filter((contract): contract is OptionContract => Boolean(contract))
    .sort((a, b) => b.qualityScore - a.qualityScore);
  const underlying = isRecord(root.underlying_asset) ? root.underlying_asset : {};

  return {
    ticker,
    underlyingPrice: toNumber(getField(underlying, ["price", "last_updated"])),
    provider: "polygon",
    updatedAt: nowIso(),
    contracts
  };
}

export async function getOptionsChain(tickerInput: string): Promise<OptionChainResponse> {
  const ticker = cleanTicker(tickerInput);
  const provider = getConfiguredProvider();
  const cacheKey = `${provider}:${ticker}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  if (provider === "invalid") {
    return errorResponse(ticker, "none", "Proveedor de datos de opciones invalido. Usa OPTIONS_DATA_PROVIDER=fmp o OPTIONS_DATA_PROVIDER=polygon.", "INVALID_PROVIDER");
  }

  if (provider === "none") {
    return errorResponse(ticker, "none", "No hay proveedor de datos de opciones configurado. Configura OPTIONS_DATA_PROVIDER y la API key correspondiente.", "NO_PROVIDER");
  }

  const apiKey = provider === "fmp" ? process.env.FMP_API_KEY : process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return errorResponse(
      ticker,
      provider,
      `No hay API key configurada para ${provider.toUpperCase()}. Configura ${provider === "fmp" ? "FMP_API_KEY" : "POLYGON_API_KEY"} en Vercel.`,
      "NO_PROVIDER"
    );
  }

  try {
    const data = provider === "fmp" ? await fetchFmpOptionChain(ticker, apiKey) : await fetchPolygonOptionChain(ticker, apiKey);
    cache.set(cacheKey, { data, expiresAt: Date.now() + OPTIONS_CACHE_MS });
    return data;
  } catch (error) {
    console.error("Options provider failed", error);
    return errorResponse(ticker, provider, "Error al cargar contratos. Revisa la API key o el proveedor.", "PROVIDER_ERROR");
  }
}
