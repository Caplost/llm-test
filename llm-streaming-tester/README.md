# LLM Streaming Tester

A simple, purely frontend application for testing concurrent streaming capabilities of large language models.

## Features

- Test concurrent streaming requests to LLM APIs
- Configurable parameters (model, max tokens, temperature)
- Visual status indicators for each request
- Response timing information
- Clean, modern UI using Tailwind CSS

## Usage

1. Simply open `index.html` in any modern web browser
2. Configure your API endpoint and parameters:
   - Endpoint URL: The API endpoint to send requests to
   - Model Name: The model identifier
   - Prompt Template: The text prompt to send to the LLM
   - Max Tokens: Maximum number of tokens to generate
   - Temperature: Controls randomness (0.0 to 2.0)
   - Concurrent Requests: Number of simultaneous requests to make

3. Click "Start Test" to begin
4. Each response will appear in its own window with status indicators
5. You can close individual response windows or clear all responses

## Requirements

- A modern web browser with JavaScript enabled
- No server-side components required
- CORS must be enabled on the LLM API server for browser requests

## Compatibility

This tester works with API endpoints that follow the OpenAI-compatible streaming format. The endpoint should support the `stream: true` parameter and return responses in the appropriate streaming format.

## Troubleshooting

If you encounter errors:

- Verify your API endpoint is correct and accessible
- Check that CORS is enabled on the server
- Confirm your model name is valid
- Try reducing the number of concurrent requests

## License

MIT 