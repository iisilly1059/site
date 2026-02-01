# Install Bare & Wisp

This guide will help you set up /bare/ and /wisp/

---

## Useful Combinations
```bash
ctrl+x - Exit
ctrl+o - Save
```
## Step 1. Install Dependencies

Make sure you have **Git**, **Node.js**, **npm**, and **PM2** installed.

```bash
# Update system if you want to
sudo apt update && sudo apt upgrade -y

# Install Git
sudo apt install git -y

# Install Node.js (LTS) & npm
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2
```

---

## Step 2. Clone the Repository

```bash
git clone https://github.com/Endlessguyin/scramjet.git
```

---

## Step 3. Start the Project

```bash
cd scramjet

# Optional: check if index.js exists
nano index.js

# Install dependencies
npm i

# Start with PM2
pm2 start index.js --name wisp-bare
```

---

## Step 4. Configure Caddy

Open your Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Add this configuration to your caddyfile:

```caddy
{
    on_demand_tls {
        ask http://localhost:5555
    }
}

:443 {
    tls {
        on_demand
    }

    handle /bare/* {
        reverse_proxy localhost:5000
    }

    handle /wisp/* {
        reverse_proxy localhost:5000
    }
}
```

---

## Step 5. Validate & Reload Caddy

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## Done!

Bare and Wisp should now be available at /bare/ and /wisp/
