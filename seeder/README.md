# Stripe Seeder

Generates high-volume test data for Stripe accounts.

## Requirements

*   Python 3.x
*   pip
*   Stripe Account + API Keys (Secret Key for platform, Account IDs for connected accounts)
*   `.env` file configured (see `.env.example`)
*   `tokens.json` file created (see below)
*   Stripe CLI (`brew install stripe/stripe-cli/stripe` or equivalent) # Required for scenario injection # <-- Note: CLI is no longer strictly required by the script itself, but might be useful for debugging.

## Installation

1.  Clone the repository.
2.  **Install Stripe CLI (Optional but Recommended):** `brew install stripe/stripe-cli/stripe` (If you don't have Homebrew, see [Stripe CLI docs](https://stripe.com/docs/stripe-cli#install)).
3.  Create a virtual environment: `python -m venv .venv`
4.  Activate the virtual environment: `source .venv/bin/activate`
5.  Install Python dependencies: `pip install -r requirements.txt`
6.  Copy `.env.example` to `.env` and fill in your Stripe test **platform** secret key and comma-separated **connected account IDs**.
7.  **Create `tokens.json`:** Create a file named `tokens.json` in the `stripe-seeder` directory. Populate it with a JSON object mapping each connected account ID (from your `.env` file) to its corresponding OAuth access token (or secret key if it's a Standard account). You can typically find these tokens/keys under Connect -> Accounts -> [Select Account] -> API keys in your Stripe dashboard (Test mode). The seeder uses these tokens *only* for the bank-swap event injection.
    ```json
    // Example tokens.json:
    {
      "acct_1RHSiGHca4FBH776": "sk_test_TOKEN_FOR_ACCT_1",
      "acct_1RHUjHC56gXymrMx": "sk_test_TOKEN_FOR_ACCT_2"
    }
    ```

## Usage

1.  Ensure your `.env` and `tokens.json` files are correctly configured.
2.  Activate the virtual environment: `source .venv/bin/activate`
3.  Run the seeder once: `python timewarp_seeder.py`
4.  Run the seeder continuously (multiple iterations): `./run_seeder_multiple.sh`

## Cron Job Setup

To run the seeder automatically every hour, add the following line to your crontab:

```crontab
0 * * * *  cd /path/to/stripe-seeder && /usr/bin/env bash -c 'source .venv/bin/activate && python timewarp_seeder.py' >> seed.log 2>&1
```

Make sure to replace `/path/to/stripe-seeder` with the actual path where you cloned the repository. 