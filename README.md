# DVA313-Project-4
Remote Monitoring Tool for Virtualized Intelligent Electronic Devices
Hitachi Energy develops intelligent electronic devices (IEDs).
To accelerate development and testing, they want to containerize the IEDs, allowing multiple virtualized IEDs to execute on a single machine.
This project is about developing a web-based monitoring tool that will be able to help identify and debug misbehaving virtualized IEDs (e.g., in terms of excessive resource utilization, or incorrect log outputs).
Suggested technology: Python for the backend
Client: Hitachi Energy


#Docker image hosting steps

- Create the docker image
    `docker build -t monitoring-app:0.0.1 .`

- Run the docker image
    `docker run -d --name monitoring_app -p 8000:8000  -v /var/run/docker.sock:/var/run/docker.sock  monitoring-app:0.0.1`


-RUNNING ON MACOS WITHOUT pip
## Homebrew (macOS) + Node.js
- Install Homebrew (if missing)  
  `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- Add Homebrew to PATH  
  `echo >> ~/.zprofile`  
  `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile`  
  `eval "$(/opt/homebrew/bin/brew shellenv)"`
- Install Node.js + npm  
  `brew install node`  
  `node -v`  
  `npm -v`
  
## Python venv 
- Create and activate venv  
  `cd ~/Desktop/DVA313/DVA313-Project-4`  
  `python3 -m venv .venv`  
  `source .venv/bin/activate`

- Install backend dependencies  
  `python -m ensurepip --upgrade`  
  `python -m pip install --upgrade pip setuptools wheel`  
  `pip install -r requirements.txt`

