﻿// Patched wallet viewer app.js

const SOMNIA_RPC = "https://dream-rpc.somnia.network";
const SOMNIA_CHAIN_ID = 50312;
const API_BASE = "https://data-api.cloud.ormi.dev/somnia/v1";
const IPFS_GATEWAY = "https://cloudflare-ipfs.com/ipfs/";

let isConnected = false;
let currentProvider = null;
let ethereumProvider = null;

async function connectInjectedWallet() {
    if (!window.ethereum) {
        alert("MetaMask is not installed.");
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts.length === 0) throw new Error("No accounts found");

        ethereumProvider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = ethereumProvider.getSigner();
        const address = await signer.getAddress();

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
        window.ethereum.on('disconnect', handleDisconnect);

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
    if (accounts.length === 0) resetConnection();
    else displayWalletInfo(accounts[0]);
}

function handleChainChanged() {
    window.location.reload();
}

function handleDisconnect() {
    console.log("MetaMask disconnected");
    resetConnection();
}

function resetConnection() {
    isConnected = false;
    currentProvider = null;
    ethereumProvider = null;

    if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
    }

    document.getElementById("walletInfo").style.display = "none";
    document.getElementById("nftGrid").innerHTML = "";
    document.getElementById("nftGrid721").innerHTML = "";
    document.getElementById("walletAddress").textContent = "";
    document.getElementById("nativeBalance").textContent = "";

    updateButtonVisibility();
}

function disconnectMetaMask() {
    if (window.ethereum) {
        window.ethereum.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }]
        }).then(resetConnection).catch((error) => {
            console.error("Error disconnecting:", error);
            resetConnection();
        });
    } else {
        resetConnection();
    }
}

async function displayWalletInfo(address) {
    document.getElementById("walletAddress").textContent = address;
    document.getElementById("walletInfo").style.display = "block";

    document.getElementById("nftGrid").innerHTML = loadingHTML("ERC-1155 NFTs");
    document.getElementById("nftGrid721").innerHTML = loadingHTML("ERC-721 NFTs");
    document.getElementById("nativeBalance").innerHTML = spinnerSmall();

    try {
        await Promise.all([
            loadNativeBalance(address),
            loadERC1155NFTs(address),
            loadERC721NFTs(address)
        ]);
    } catch (err) {
        console.error("Error in displayWalletInfo:", err);
    }
}

function loadingHTML(label) {
    return `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
            <h5 class="text-muted">Loading ${label}...</h5>
            <p class="text-muted small">This may take a few moments</p>
        </div>`;
}

function spinnerSmall() {
    return `
        <div class="spinner-border spinner-border-sm text-light" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>`;
}

function updateButtonVisibility() {
    document.getElementById("connectButtons").style.display = isConnected ? "none" : "block";
    document.getElementById("disconnectButtons").style.display = isConnected ? "block" : "none";
}

async function loadNativeBalance(address) {
    try {
        const res = await fetch(`${API_BASE}/address/${address}/balance/native`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        const balanceSTT = parseFloat(data.balance || 0).toFixed(3);
        document.getElementById("nativeBalance").textContent = `${balanceSTT} STT`;
    } catch (err) {
        console.error("Failed to fetch STT balance", err);
        throw err;
    }
}

function convertIpfsUrl(url) {
    if (!url) return "";
    return url.startsWith('ipfs://') ? `${IPFS_GATEWAY}${url.slice(7)}` : url;
}

async function loadERC1155NFTs(address) {
    try {
        const res = await fetch(`${API_BASE}/address/${address}/balance/erc1155?page-size=100`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        const container = document.getElementById("nftGrid");
        container.innerHTML = "";

        if (!data.erc1155TokenBalances?.length) {
            container.innerHTML = noNftsHTML("ERC-1155");
            return;
        }

        data.erc1155TokenBalances.forEach(item => {
            const imageUrl = convertIpfsUrl(item.metadata?.imageUri);
            const attributes = item.metadata?.attributes;
            const readableAttributes = (attributes && attributes !== "null") ?
                `<p class='card-text'><strong>Attributes:</strong> ${attributes}</p>` : "";

            const card = document.createElement("div");
            card.className = "col";
            card.innerHTML = `
                <div class="card h-100">
                  <img src="${imageUrl}" class="card-img-top" alt="NFT" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x300?text=Image+Not+Found'">
                  <div class="card-body">
                    <h5 class="card-title">${item.metadata?.name || "Unnamed NFT"}</h5>
                    <p class="card-text">${item.metadata?.description || ""}</p>
                    <p class="card-text"><strong>Token ID:</strong> ${item.tokenId}</p>
                    <p class="card-text"><strong>Balance:</strong> ${item.balance}</p>
                    ${readableAttributes}
                    <div class="mt-3">
                      <label for="recipient-${item.tokenId}" class="form-label">Send to Address:</label>
                      <input type="text" class="form-control" id="recipient-${item.tokenId}" placeholder="0x...">
                      <label for="amount-${item.tokenId}" class="form-label">Amount:</label>
                      <input type="number" class="form-control" id="amount-${item.tokenId}" min="1" max="${item.balance}" value="1">
                      <button class="btn btn-primary w-100 mt-2" onclick="sendERC1155('${item.address}', '${item.tokenId}', '${item.balance}')">Send NFT</button>
                    </div>
                  </div>
                </div>`;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to fetch ERC-1155 NFTs:", err);
    }
}

function noNftsHTML(type) {
    return `
        <div class="col-12 text-center py-5">
            <div class="alert alert-info" role="alert">
                <h4 class="alert-heading">No ${type} NFTs Found</h4>
                <p>No ${type} tokens were found in this wallet address.</p>
            </div>
        </div>`;
}

async function sendERC1155(contractAddress, tokenId, maxBalance) {
    try {
        const recipient = document.getElementById(`recipient-${tokenId}`).value;
        const amount = document.getElementById(`amount-${tokenId}`).value;

        if (!ethers.utils.isAddress(recipient)) return alert('Please enter a valid Ethereum address');
        if (amount <= 0 || amount > maxBalance) return alert(`Enter a valid amount between 1 and ${maxBalance}`);

        const signer = ethereumProvider.getSigner();
        const contract = new ethers.Contract(
            contractAddress,
            ["function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"],
            signer
        );

        const tx = await contract.safeTransferFrom(await signer.getAddress(), recipient, tokenId, amount, "0x");
        await tx.wait();

        alert('Transfer successful!');
        displayWalletInfo(await signer.getAddress());
    } catch (err) {
        console.error("Transfer failed:", err);
        alert('Transfer failed: ' + (err.message || 'Unknown error'));
    }
}

async function loadERC721NFTs(address) {
    try {
        const res = await fetch(`${API_BASE}/address/${address}/balance/erc721?page-size=100`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        const container = document.getElementById("nftGrid721");
        container.innerHTML = "";

        if (!data.erc721TokenBalances?.length) {
            container.innerHTML = noNftsHTML("ERC-721");
            return;
        }

        data.erc721TokenBalances.forEach(item => {
            const imageUrl = convertIpfsUrl(item.metadata?.imageUri);
            const card = document.createElement("div");
            card.className = "col";
            card.innerHTML = `
                <div class="card h-100">
                    <img src="${imageUrl}" class="card-img-top" alt="NFT" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x300?text=Image+Not+Found'">
                    <div class="card-body">
                        <h5 class="card-title">${item.metadata?.name || "Unnamed NFT"}</h5>
                        <p class="card-text">${item.metadata?.description || ""}</p>
                        <p class="card-text"><strong>Token ID:</strong> ${item.tokenId}</p>
                        <p class="card-text"><strong>Contract:</strong> <code>${item.address}</code></p>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to fetch ERC-721 NFTs:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("connectInjected")?.addEventListener("click", connectInjectedWallet);
    document.getElementById("disconnectMetaMask")?.addEventListener("click", disconnectMetaMask);
});