import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const forecastPath = path.join(
  __dirname,
  '../../integration/revenue-forecast' 
);


const generateForecastData = (sellerId, weeks = 6) => {
    return new Promise((resolve, reject) => {

        const pythonExe = os.platform() === 'win32'
            ? path.join(forecastPath, '.venv', 'Scripts', 'python.exe')
            : path.join(forecastPath, '.venv', 'bin', 'python3');

        // Spawn the Python process
        const python = spawn(pythonExe, [
            path.join(forecastPath, 'main.py'),
            'forecast',
            '--seller-id', sellerId,
            '--weeks', weeks.toString()
        ], {
            cwd: forecastPath
        });

        let output = '';
        let errorOutput = '';

        // Collect data chunks from standard output
        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        // Collect error chunks from standard error
        python.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        python.on('close', (code) => {
            try {
                // ALWAYS try to parse the output first, because our Python script 
                // prints errors as JSON to stdout before exiting.
                const parsedResult = JSON.parse(output);

                if (parsedResult.status === 'success') {
                    resolve(parsedResult.data);
                } else {
                    // This catches the handled Python exceptions (e.g., "Not enough data")
                    reject(new Error(`Python Forecaster Error: ${parsedResult.message}`));
                }
            } catch (err) {
                // If parsing fails completely, THEN we fall back to checking the exit code and stderr
                if (code !== 0) {
                    const fallbackError = errorOutput || output || 'Unknown Python crash';
                    reject(new Error(`Process failed (Code ${code}): ${fallbackError}`));
                } else {
                    reject(new Error('Invalid JSON received from Python script.'));
                }
            }
        });
    });
};

export { generateForecastData };