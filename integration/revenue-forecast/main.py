import sys
import os
import json
import argparse
import pandas as pd
import warnings
from datetime import datetime, timezone
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing


warnings.filterwarnings("ignore")

class SellerForecaster:
    def __init__(self, data_dir='../data'):
        """Initializes the forecaster and loads the datasets into memory."""
        self.data_dir = data_dir
        self.df_items = None
        self.df_orders = None
        self._load_data()

    def _load_data(self):
        """Loads the CSV data. Throws an error if files are missing."""
        items_path = os.path.join(self.data_dir, 'olist_order_items_dataset.csv')
        orders_path = os.path.join(self.data_dir, 'olist_orders_dataset.csv')
        
        try:
            self.df_items = pd.read_csv(items_path)
            self.df_orders = pd.read_csv(orders_path)
        except FileNotFoundError:
            raise Exception(f"Could not find data files at {items_path} or {orders_path}. Check your --data-dir path.")

    def forecast(self, seller_id, weeks_to_predict=4):
        """Filters data for a seller, fits the ARIMA model, and predicts future weeks."""
        # 1. Merge and Filter by Seller
        df_merged = pd.merge(self.df_items, self.df_orders, on='order_id', how='inner')
        df_seller = df_merged[df_merged['seller_id'] == seller_id].copy()

        if df_seller.empty:
            raise Exception(f"No order data found for seller_id: {seller_id}")

        # 2. Time-Series Preparation
        df_seller['order_purchase_timestamp'] = pd.to_datetime(df_seller['order_purchase_timestamp'])
        df_seller.set_index('order_purchase_timestamp', inplace=True)

        # Get the latest year of data
        latest_date = df_seller.index.max()
        start_date = latest_date - pd.DateOffset(months=12)
        df_seller_filtered = df_seller[df_seller.index >= start_date]

        # Resample weekly and fill empties
        weekly_data = df_seller_filtered.resample('W-SUN').agg(
            weekly_revenue=('price', 'sum'),
            weekly_orders=('order_id', 'nunique')
        ).fillna(0)

        # Ensure statsmodels understands the frequency
        weekly_data = weekly_data.asfreq('W-SUN', fill_value=0)
        y = weekly_data['weekly_revenue']

        if len(y) < 10:
            raise Exception(f"Not enough data points ({len(y)} weeks) to train the ARIMA model. Need at least 10.")

        # 3. Model Fit (Training on ALL available data in the past year)
        # model = ARIMA(y, order=(2, 1, 1), seasonal_order=(1, 1, 1, 4))
        # model_fit = model.fit()

        model = ExponentialSmoothing(y, trend= 'add', seasonal= 'mul', seasonal_periods = 14,  damped_trend= False, use_boxcox= False, initialization_method="estimated")
        model_fit = model.fit()

        # 4. Forecast into the future
        forecast_series = model_fit.forecast(steps=weeks_to_predict)

        # 5. Prepare Data for JSON serialization
        # Generate an ISO 8601 UTC timestamp for when this forecast was generated
        generated_at = datetime.now(timezone.utc).isoformat()

        return {
            "seller_id": seller_id,
            "forecast_generated_at": generated_at,
            "historical_dates": y.index.strftime('%Y-%m-%d').tolist(),
            "historical_revenue": y.tolist(),
            "forecast_dates": forecast_series.index.strftime('%Y-%m-%d').tolist(),
            "forecast_revenue": forecast_series.tolist()
        }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Seller Revenue Forecaster')
    parser.add_argument('command', choices=['forecast'], help='Action to perform')
    parser.add_argument('--seller-id', required=True, help='The target seller ID')
    parser.add_argument('--data-dir', default='../data', help='Directory containing CSVs (default: ../data)')
    parser.add_argument('--weeks', type=int, default=4, dest='weeks_to_predict', help='Number of future weeks to predict (default: 4)')
    
    args = parser.parse_args()

    if args.command == 'forecast':
        try:
            forecaster = SellerForecaster(data_dir=args.data_dir)
            result = forecaster.forecast(
                seller_id=args.seller_id, 
                weeks_to_predict=args.weeks_to_predict
            )
            
            print(json.dumps({
                "status": "success",
                "data": result
            }))
            sys.exit(0)
            
        except Exception as e:
            print(json.dumps({
                "status": "error",
                "message": str(e)
            }))
            sys.exit(1)