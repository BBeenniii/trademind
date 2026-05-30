from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datasets import dataset_status, get_dataset_metadata, process_raw_dataset
from market_pipeline import (
    load_prices,
    prepare_market_frame,
    evaluate_feedback_model,
    predict_live_signal,
    predict_latest_signal,
    retrain_signal_model,
    run_backtest,
    train_signal_model,
)
from model_registry import compare_models, get_feature_importance, train_registered_model
from online_learning import online_status, update_online_learner

app = FastAPI(title="TradeMind ML Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PairRequest(BaseModel):
    pair: str = "EURUSD"
    modelVersion: str | None = None

class LiveCandlePayload(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float | None = 0

class PredictLiveRequest(BaseModel):
    pair: str = "EURUSD"
    modelVersion: str | None = None
    candles: list[LiveCandlePayload]

class FeedbackPayload(BaseModel):
    signal: str
    confidence: float
    closePrice: float
    rsi: float | None = None
    smaFast: float | None = None
    smaSlow: float | None = None
    volatility: float | None = None
    momentum: float | None = None
    returnPct: float | None = None
    outcome: str
    pnl: float | None = None
    pnlPercent: float | None = None

class ModelFeedbackRequest(BaseModel):
    version: str
    pair: str = "EURUSD"
    feedbackRecords: list[FeedbackPayload] = Field(default_factory=list)

class TrainModelRequest(BaseModel):
    modelType: str = "LIGHTGBM"
    timeframe: str = "5m"
    version: str | None = None

class CompareModelsRequest(BaseModel):
    timeframe: str = "5m"
    includeXgboost: bool = False

class OnlineUpdateRequest(BaseModel):
    feedbackRecords: list[FeedbackPayload] = Field(default_factory=list)

@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}

@app.get("/dataset/status")
def get_dataset_status():
    return dataset_status()

@app.get("/dataset/metadata")
def dataset_metadata():
    return get_dataset_metadata() or {}

@app.post("/dataset/process")
def process_dataset():
    return process_raw_dataset()

@app.post("/process")
def process_data(payload: PairRequest = PairRequest()):
    prices = load_prices(payload.pair)
    frame = prepare_market_frame(prices)
    rows = frame.tail(180).copy()
    rows["timestamp"] = rows["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "pair": payload.pair,
        "rows": rows.to_dict(orient="records"),
    }

@app.post("/train")
def train_model(payload: PairRequest = PairRequest()):
    result = train_signal_model(payload.pair)
    return {
        "pair": payload.pair,
        "trainedRows": result.trained_rows,
        "testRows": result.test_rows,
        "testAccuracy": result.test_accuracy,
        "modelPath": str(result.model_path),
    }

@app.post("/train-model")
def train_advanced_model(payload: TrainModelRequest):
    return train_registered_model(payload.modelType, payload.timeframe, payload.version)

@app.post("/models/compare")
def model_comparison(payload: CompareModelsRequest):
    return compare_models(payload.timeframe, payload.includeXgboost)

@app.get("/models/{version}/feature-importance")
def feature_importance(version: str):
    return get_feature_importance(version)

@app.post("/predict")
def predict(payload: PairRequest = PairRequest()):
    return predict_latest_signal(payload.pair, payload.modelVersion)

@app.post("/predict-live")
def predict_live(payload: PredictLiveRequest):
    candles = [candle.model_dump() for candle in payload.candles]
    return predict_live_signal(payload.pair, candles, payload.modelVersion)

@app.post("/retrain")
def retrain(payload: ModelFeedbackRequest):
    feedback = [record.model_dump() for record in payload.feedbackRecords]
    return retrain_signal_model(payload.version, feedback, payload.pair)

@app.post("/evaluate-model")
def evaluate_model(payload: ModelFeedbackRequest):
    feedback = [record.model_dump() for record in payload.feedbackRecords]
    return evaluate_feedback_model(payload.version, feedback)

@app.get("/online/status")
def get_online_status():
    return online_status()

@app.post("/online/update")
def update_online(payload: OnlineUpdateRequest):
    feedback = [record.model_dump() for record in payload.feedbackRecords]
    return update_online_learner(feedback)

@app.post("/backtest")
def backtest(payload: PairRequest = PairRequest()):
    return run_backtest(payload.pair)