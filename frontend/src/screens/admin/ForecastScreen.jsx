import React from 'react';
import { useSelector } from 'react-redux';
import { useGetSellerForecastQuery } from '../../slices/forecastApiSlice';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

export const ForecastScreen = () => {
    const { userInfo } = useSelector((state) => state.auth);
    const sellerId = userInfo?._id;

    const { data: forecastData, isLoading, error } = useGetSellerForecastQuery(sellerId, {
        skip: !sellerId,
    });

    console.log('Forecast Data:', forecastData);

    const prepareChartData = () => {
        if (!forecastData) return { labels: [], datasets: [] };

        const {
            historical_dates,
            historical_revenue,
            forecast_dates,
            forecast_revenue,
        } = forecastData;

        // Combine dates for the X-axis
        const labels = [...historical_dates, ...forecast_dates];

        // Get the final historical value to connect the two lines seamlessly
        const lastHistoricalValue = historical_revenue[historical_revenue.length - 1];

        // Pad the historical data with nulls where the forecast data lives
        const historicalSeries = [
            ...historical_revenue,
            ...Array(forecast_dates.length).fill(null),
        ];

        // Pad the forecast data with nulls where the historical data lives
        // (Notice we add `lastHistoricalValue` so the lines touch)
        const forecastSeries = [
            ...Array(historical_revenue.length - 1).fill(null),
            lastHistoricalValue,
            ...forecast_revenue,
        ];

        return {
            labels,
            datasets: [
                {
                    label: 'Actual Revenue',
                    data: historicalSeries,
                    borderColor: 'rgba(54, 162, 235, 1)', // Solid Blue
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.3, // Adds a slight curve to the line
                    pointRadius: 2,
                },
                {
                    label: 'Forecasted Revenue',
                    data: forecastSeries,
                    borderColor: 'rgba(255, 99, 132, 1)', // Red
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderDash: [5, 5], // Makes the line dashed
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                },
            ],
        };
    };

    // 4. Configure Chart Options
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false, // Allows you to set a custom height via CSS/Div
        plugins: {
            datalabels: {
                display: false,
            },
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Weekly Revenue Forecast',
                font: { size: 18 }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => '$' + value
                }
            }
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Revenue Forecast</h1>

            {!userInfo && <p>Please log in as a seller to view your forecast.</p>}

            {isLoading && <h2>Building your forecast model...</h2>}

            {error && (
                <div style={{ color: 'red', border: '1px solid red', padding: '10px' }}>
                    <h3>Failed to load forecast</h3>
                    {/* Change this line temporarily to stringify the error */}
                    <p>{JSON.stringify(error)}</p>
                </div>
            )}


            {!isLoading && !error && forecastData && (
                <div style={{ height: '500px', width: '100%', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <Line data={prepareChartData()} options={chartOptions} />
                </div>
            )}
        </div>
    );
};