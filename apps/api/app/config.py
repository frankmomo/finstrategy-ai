from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FinStrategy Engine"
    environment: str = "development"
    database_url: str = "sqlite:///./local.db"
    polygon_api_key: str = ""
    openai_api_key: str = ""
    fmp_api_key: str = ""
    deepseek_api_key: str = ""
    app_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    tickers: str = "SPY,MSFT,TSLA,NVDA,AAPL,META,GOOGL,NFLX,AMZN"
    polygon_ws_url: str = "wss://socket.polygon.io/stocks"
    polygon_ingestion_mode: str = "websocket"
    market_data_timeframe: str = ""
    polygon_rest_poll_seconds: int = 30
    polygon_rest_ticker_delay_seconds: float = 0
    enable_api_ingestion: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def ticker_list(self) -> list[str]:
        return [ticker.strip().upper() for ticker in self.tickers.split(",") if ticker.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def active_market_timeframe(self) -> str:
        if self.market_data_timeframe:
            return self.market_data_timeframe
        return "1d" if self.polygon_ingestion_mode == "rest_poll" else "1m"


@lru_cache
def get_settings() -> Settings:
    return Settings()
