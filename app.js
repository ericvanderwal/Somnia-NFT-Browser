﻿const SOMNIA_RPC = "https://dream-rpc.somnia.network";
const SOMNIA_CHAIN_ID = 50312;
const API_BASE = "https://data-api.cloud.ormi.dev/somnia/v1";
const CORS_PROXY = "https://corsproxy.io/?";

// Global state to track connection
let isConnected = false;
let currentProvider = null;
let ethereumProvider = null;

async function connectInjectedWallet() {
    if (!window.ethereum) {
        alert("MetaMask is not installed.");
        return;
    }

    try {
        // Request account access
        const accounts = await window.ethereum.request({method: "eth_requestAccounts"});
        if (accounts.length === 0) {
            throw new Error("No accounts found");
        }

        // Set up provider and signer
        ethereumProvider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = ethereumProvider.getSigner();
        const address = await signer.getAddress();

        // Set up event listeners
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
        window.ethereum.on('disconnect', handleDisconnect);

        // Update global state
        isConnected = true;
        currentProvider = 'metamask';

        displayWalletInfo(address);
        updateButtonVisibility();
    } catch (err) {
        console.error("MetaMask connection failed:", err);
        resetConnection();
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User has disconnected their wallet
        resetConnection();
    } else {
        // Update the UI with the new account
        displayWalletInfo(accounts[0]);
    }
}

function handleChainChanged() {
    // Reload the page when the chain changes
    window.location.reload();
}

function handleDisconnect() {
    resetConnection();
}

function resetConnection() {
    // Reset global state
    isConnected = false;
    currentProvider = null;
    ethereumProvider = null;

    // Remove event listeners
    if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
    }

    // Clear UI
    document.getElementById("walletInfo").style.display = "none";
    document.getElementById("nftGrid").innerHTML = "";
    document.getElementById("nftGrid721").innerHTML = "";
    document.getElementById("walletAddress").textContent = "";
    document.getElementById("nativeBalance").textContent = "";

    // Update button visibility
    updateButtonVisibility();
}

function disconnectMetaMask() {
    resetConnection();
    console.log("MetaMask disconnected");
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
    await loadERC721NFTs(address);
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
        const res = await fetch(`${CORS_PROXY}${encodeURIComponent(`${API_BASE}/address/${address}/balance/native`)}`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        const balanceSTT = parseFloat(data.balanceValue?.value || 0).toFixed(3);
        document.getElementById("nativeBalance").textContent = `${balanceSTT} STT`;
    } catch (err) {
        console.error("Failed to fetch STT balance", err);
    }
}

async function loadERC1155NFTs(address) {
    try {
        const res = await fetch(`${CORS_PROXY}${encodeURIComponent(`${API_BASE}/address/${address}/balance/erc1155?page-size=100`)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        console.log('ERC1155 Response:', data); // Debug log
        const container = document.getElementById("nftGrid");
        container.innerHTML = "";

        if (!data || !data.erc1155TokenBalances || data.erc1155TokenBalances.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="alert alert-info" role="alert">
                        <h4 class="alert-heading">No ERC-1155 NFTs Found</h4>
                        <p>No ERC-1155 tokens were found in this wallet address.</p>
                    </div>
                </div>`;
            return;
        }

        data.erc1155TokenBalances.forEach((item) => {
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
    } catch (err) {
        console.error("Failed to fetch ERC-1155 NFTs:", err);
        const container = document.getElementById("nftGrid");
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="alert alert-danger" role="alert">
                    <h4 class="alert-heading">Error Loading ERC-1155 NFTs</h4>
                    <p>There was a problem loading your ERC-1155 NFTs. Please try again later.</p>
                    <small class="text-muted">Error: ${err.message}</small>
                </div>
            </div>`;
    }
}

async function loadERC721NFTs(address) {
    try {
        const res = await fetch(`${CORS_PROXY}${encodeURIComponent(`${API_BASE}/address/${address}/balance/erc721?page-size=100`)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        console.log('ERC721 Response:', data); // Debug log
        const container = document.getElementById("nftGrid721");
        container.innerHTML = "";

        if (!data || !data.erc721TokenBalances || data.erc721TokenBalances.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="alert alert-info" role="alert">
                        <h4 class="alert-heading">No ERC-721 NFTs Found</h4>
                        <p>No ERC-721 tokens were found in this wallet address.</p>
                    </div>
                </div>`;
            return;
        }

        data.erc721TokenBalances.forEach((item) => {
            const card = document.createElement("div");
            card.className = "col";
            card.innerHTML = `
                <div class="card h-100">
                    <img src="${item.metadata?.imageUri || ""}" class="card-img-top" alt="${item.metadata?.name || "NFT"}">
                    <div class="card-body">
                        <h5 class="card-title">${item.metadata?.name || "Unnamed NFT"}</h5>
                        <p class="card-text">${item.metadata?.description || ""}</p>
                        <p class="card-text"><strong>Token ID:</strong> ${item.tokenId}</p>
                        <p class="card-text"><strong>Contract:</strong> <code class="small">${item.address}</code></p>
                        ${item.metadata?.attributes ? `<p class="card-text"><strong>Attributes:</strong> ${item.metadata.attributes}</p>` : ''}
                        ${item.metadata?.mintedTimestamp ? `<p class="card-text"><small class="text-muted">Minted: ${new Date(item.metadata.mintedTimestamp).toLocaleDateString()}</small></p>` : ''}
                    </div>
                </div>`;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to fetch ERC-721 NFTs:", err);
        const container = document.getElementById("nftGrid721");
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="alert alert-danger" role="alert">
                    <h4 class="alert-heading">Error Loading ERC-721 NFTs</h4>
                    <p>There was a problem loading your ERC-721 NFTs. Please try again later.</p>
                    <small class="text-muted">Error: ${err.message}</small>
                </div>
            </div>`;
    }
}

// Connect event listeners
document.getElementById("connectInjected").addEventListener("click", connectInjectedWallet);
document.getElementById("connectWalletConnect").addEventListener("click", connectWithWalletConnect);

// Disconnect event listener
document.getElementById("disconnectMetaMask").addEventListener("click", disconnectMetaMask);