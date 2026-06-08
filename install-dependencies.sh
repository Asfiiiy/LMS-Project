#!/bin/bash
# Inspire LMS - Complete Dependency Installer
# Run as: bash install-dependencies.sh
# Ubuntu 24.04 LTS (also works on 22.04 with minor package name differences)

set -e

echo "🚀 Starting Inspire LMS dependency installation..."
echo "=================================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
sudo apt update -y
sudo apt upgrade -y
echo -e "${GREEN}✅ System updated${NC}"

echo -e "${YELLOW}Step 2: Installing essential tools...${NC}"
sudo apt install -y \
  build-essential \
  curl \
  wget \
  git \
  unzip \
  zip \
  nano \
  python3 \
  python3-pip \
  software-properties-common
echo -e "${GREEN}✅ Essential tools installed${NC}"

echo -e "${YELLOW}Step 3: Installing Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
echo -e "${GREEN}✅ Node.js $(node --version) installed${NC}"

echo -e "${YELLOW}Step 4: Installing PM2...${NC}"
sudo npm install -g pm2@latest
echo -e "${GREEN}✅ PM2 installed${NC}"

echo -e "${YELLOW}Step 5: Installing MySQL...${NC}"
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
echo -e "${GREEN}✅ MySQL installed${NC}"

echo -e "${YELLOW}Step 6: Installing Nginx...${NC}"
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
echo -e "${GREEN}✅ Nginx installed${NC}"

echo -e "${YELLOW}Step 7: Installing LibreOffice...${NC}"
sudo apt install -y libreoffice
echo -e "${GREEN}✅ LibreOffice installed${NC}"

echo -e "${YELLOW}Step 8: Installing Certbot...${NC}"
sudo apt install -y certbot python3-certbot-nginx
echo -e "${GREEN}✅ Certbot installed${NC}"

echo -e "${YELLOW}Step 9: Configuring firewall (UFW)...${NC}"
sudo apt install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo -e "${YELLOW}⚠️  Review rules before enabling: sudo ufw status${NC}"
echo -e "${YELLOW}   Enable manually when ready: sudo ufw enable${NC}"

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Core system dependencies installed!${NC}"
echo "=================================================="
echo ""
echo "Versions:"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "MySQL: $(mysql --version 2>&1 | head -1)"
echo "Nginx: $(nginx -v 2>&1)"
echo ""
echo "Next: Clone repo, create MySQL database and user, configure backend/.env,"
echo "run migrations, npm install (root + backend), npm run build, pm2 start ecosystem.config.js"
echo "See DEPLOYMENT_GUIDE.md for full steps."
