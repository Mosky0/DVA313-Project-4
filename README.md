# DVA313-Project-4
Remote Monitoring Tool for Virtualized Intelligent Electronic Devices
Hitachi Energy develops intelligent electronic devices (IEDs).
To accelerate development and testing, they want to containerize the IEDs, allowing multiple virtualized IEDs to execute on a single machine.
This project is about developing a web-based monitoring tool that will be able to help identify and debug misbehaving virtualized IEDs (e.g., in terms of excessive resource utilization, or incorrect log outputs).
Suggested technology: Python for the backend
Client: Hitachi Energy

#Use docker compose
- Run docker compose
    `docker compose up --build -d`

#Docker image hosting steps without docker compose (No need of this just for information)

- Create the docker image
    `docker build -t monitoring-app:0.0.1 .`

- Run the docker image
    `docker run -d --name monitoring_app -p 8000:8000  -v /var/run/docker.sock:/var/run/docker.sock  monitoring-app:0.0.1`

-Move to frontend dir `cd frontend`

- Create frontend docker image
    `docker build -f dockerfile -t monitoring-frontend:0.0.1 .`

- Run the docker image frontend
    `docker run -d  --name frontend  -p 3000:3000  monitoring-frontend:0.0.1`