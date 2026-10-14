import nautilus_trader
from nautilus_trader.model import TraderId

def main():
    print("Nautilus version:", nautilus_trader.__version__)
    print(TraderId("TESTER-001"))


if __name__ == "__main__":
    main()
