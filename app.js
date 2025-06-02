﻿﻿﻿﻿const SOMNIA_RPC = "https://dream-rpc.somnia.network";
const SOMNIA_CHAIN_ID = 50312;

// Global state to track connection
let isConnected = false;
let currentProvider = null;

async function connectInjectedWallet() {
    if (!window.ethereum) {
        alert("MetaMask is not installed.");
        return;
    }

    try {
        await window.ethereum.request({method: "eth_requestAccounts"});
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();

        // Update global state
        isConnected = true;
        currentProvider = 'metamask';

        displayWalletInfo(address);
        updateButtonVisibility();
    } catch (err) {
        console.error("MetaMask connection failed:", err);
    }
}

async function connectWithWalletConnect() {
    try {
        const wcProvider = new WalletConnectProvider.default({
            rpc: {[SOMNIA_CHAIN_ID]: SOMNIA_RPC},
            chainId: SOMNIA_CHAIN_ID,
        });

        await wcProvider.enable();

        const provider = new ethers.providers.Web3Provider(wcProvider);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        displayWalletInfo(address);
    } catch (err) {
        console.error("WalletConnect connection failed:", err);
    }
}

async function displayWalletInfo(address) {
    document.getElementById("walletAddress").textContent = address;
    document.getElementById("walletInfo").style.display = "block";
    await loadNativeBalance(address);
    await loadERC1155NFTs(address);
}

function disconnectMetaMask() {
    // Reset global state
    isConnected = false;
    currentProvider = null;

    // Hide wallet info and NFTs
    document.getElementById("walletInfo").style.display = "none";
    document.getElementById("nftGrid").innerHTML = "";

    // Update button visibility
    updateButtonVisibility();

    console.log("MetaMask disconnected");
}

function updateButtonVisibility() {
    const connectButtons = document.getElementById("connectButtons");
    const disconnectButtons = document.getElementById("disconnectButtons");

    if (isConnected && currentProvider === 'metamask') {
        connectButtons.style.display = "none";
        disconnectButtons.style.display = "block";
    } else {
        connectButtons.style.display = "block";
        disconnectButtons.style.display = "none";
    }
}

async function loadNativeBalance(address) {
    try {
        const res = await fetch(`https://data-api.cloud.ormi.dev/somnia/v1/address/${address}/balance/native`);
        const data = await res.json();
        const balanceSTT = parseFloat(data.balanceValue?.value || 0).toFixed(3);
        document.getElementById("nativeBalance").textContent = `${balanceSTT} STT`;
    } catch (err) {
        console.error("Failed to fetch STT balance", err);
    }
}

async function loadERC1155NFTs(address) {
    try {
        const res = await fetch(`https://data-api.cloud.ormi.dev/somnia/v1/address/${address}/balance/erc1155`);
        const data = await res.json();
        const container = document.getElementById("nftGrid");
        container.innerHTML = "";

        (data.erc1155TokenBalances || []).forEach((item) => {
            const card = document.createElement("div");
            card.className = "col";
            card.innerHTML = `
        <div class="card h-100">
          <img src="${item.metadata?.imageUri || ""}" class="card-img-top" alt="${item.metadata?.name || "NFT"}">
          <div class="card-body">
            <h5 class="card-title">${item.metadata?.name || "Unnamed NFT"}</h5>
            <p class="card-text">${item.metadata?.description || ""}</p>
            <p class="card-text"><strong>Token ID:</strong> ${item.tokenId}</p>
            <p class="card-text"><strong>Balance:</strong> ${item.balance}</p>
          </div>
        </div>
      `;
            container.appendChild(card);
        });

        if (!data.erc1155TokenBalances?.length) {
            container.innerHTML = "<p class='text-muted'>No ERC-1155 tokens found.</p>";
        }
    } catch (err) {
        console.error("Failed to fetch NFTs", err);
    }
}

// Connect event listeners
document.getElementById("connectInjected").addEventListener("click", connectInjectedWallet);
document.getElementById("connectWalletConnect").addEventListener("click", connectWithWalletConnect);

// Disconnect event listener
document.getElementById("disconnectMetaMask").addEventListener("click", disconnectMetaMask);