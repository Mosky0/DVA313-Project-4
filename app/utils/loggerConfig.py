import logging
import sys
import os

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"

Log_Level_Config = os.environ.get("LOG_LEVEL", "INFO")
LogLevel = getattr(logging, Log_Level_Config.upper(), logging.INFO)

if not logging.getLogger().hasHandlers():
    logging.basicConfig(
        level=LogLevel,
        format=LOG_FORMAT,
        stream=sys.stdout,
    )

def InitializeLogger(name=None):
    return logging.getLogger(name or "app")
