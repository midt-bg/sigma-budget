"""Run a build with a Python audit hook rejecting network access."""
import runpy
import sys


def deny_network(event, args):
    if event in ("socket.connect", "socket.getaddrinfo", "socket.bind"):
        raise RuntimeError("network disabled during build: " + event)
    if event == "subprocess.Popen":
        from pathlib import Path
        if Path(str(args[0])).name in {"curl", "wget", "ssh", "nc"}:
            raise RuntimeError("network command disabled during build")


def main():
    module = sys.argv.pop(1)
    sys.addaudithook(deny_network)
    runpy.run_module(module, run_name="__main__")


if __name__ == "__main__":
    main()
