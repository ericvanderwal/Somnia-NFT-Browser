﻿const SOMNIA_RPC = "https://dream-rpc.somnia.network";
const SOMNIA_CHAIN_ID = 50312;
const API_BASE = "https://data-api.cloud.ormi.dev/somnia/v1";
const IPFS_GATEWAY = "https://cloudflare-ipfs.com/ipfs/";

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
    console.log("MetaMask disconnected");
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
    if (window.ethereum) {
        // Request account disconnection
        window.ethereum.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }]
        }).then(() => {
            resetConnection();
        }).catch((error) => {
            console.error("Error disconnecting:", error);
            // Still reset the connection even if the request fails
            resetConnection();
        });
    } else {
        resetConnection();
    }
}

async function displayWalletInfo(address) {
    // Show wallet info first
    document.getElementById("walletAddress").textContent = address;
    document.getElementById("walletInfo").style.display = "block";
    
    // Show loading states with improved styling
    document.getElementById("nftGrid").innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <h5 class="text-muted">Loading ERC-1155 NFTs...</h5>
            <p class="text-muted small">This may take a few moments</p>
        </div>`;
    
    document.getElementById("nftGrid721").innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Loading...</span>
            </div>
            <h5 class="text-muted">Loading ERC-721 NFTs...</h5>
            <p class="text-muted small">This may take a few moments</p>
        </div>`;

    // Show loading state for balance
    document.getElementById("nativeBalance").innerHTML = `
        <div class="spinner-border spinner-border-sm text-light" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>`;

    try {
        // Load data in parallel
        await Promise.all([
            loadNativeBalance(address).catch(err => {
                console.error("Error loading native balance:", err);
                document.getElementById("nativeBalance").innerHTML = `
                    <span class="badge bg-warning text-dark">Unable to load balance</span>
                    <button class="btn btn-sm btn-outline-secondary ms-2" onclick="loadNativeBalance('${address}')">
                        <i class="bi bi-arrow-clockwise"></i> Retry
                    </button>`;
            }),
            loadERC1155NFTs(address).catch(err => {
                console.error("Error loading ERC-1155 NFTs:", err);
                const container = document.getElementById("nftGrid");
                container.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <div class="alert alert-warning" role="alert">
                            <h4 class="alert-heading">Unable to Load ERC-1155 NFTs</h4>
                            <p>There was a problem loading your ERC-1155 NFTs. This might be due to network issues or API restrictions.</p>
                            <hr>
                            <p class="mb-0">
                                <button class="btn btn-outline-primary" onclick="loadERC1155NFTs('${address}')">
                                    <i class="bi bi-arrow-clockwise"></i> Try Again
                                </button>
                            </p>
                        </div>
                    </div>`;
            }),
            loadERC721NFTs(address).catch(err => {
                console.error("Error loading ERC-721 NFTs:", err);
                const container = document.getElementById("nftGrid721");
                container.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <div class="alert alert-warning" role="alert">
                            <h4 class="alert-heading">Unable to Load ERC-721 NFTs</h4>
                            <p>There was a problem loading your ERC-721 NFTs. This might be due to network issues or API restrictions.</p>
                            <hr>
                            <p class="mb-0">
                                <button class="btn btn-outline-primary" onclick="loadERC721NFTs('${address}')">
                                    <i class="bi bi-arrow-clockwise"></i> Try Again
                                </button>
                            </p>
                        </div>
                    </div>`;
            })
        ]);
    } catch (err) {
        console.error("Error in displayWalletInfo:", err);
    }
}

function updateButtonVisibility() {
    const connectButtons = document.getElementById("connectButtons");
    const disconnectButtons = document.getElementById("disconnectButtons");

    if (isConnected) {
        connectButtons.style.display = "none";
        disconnectButtons.style.display = "block";
    } else {
        connectButtons.style.display = "block";
        disconnectButtons.style.display = "none";
    }
}

async function loadNativeBalance(address) {
    try {
        const res = await fetch(`${API_BASE}/address/${address}/balance/native`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        const balanceSTT = parseFloat(data.balanceValue?.value || 0).toFixed(3);
        document.getElementById("nativeBalance").textContent = `${balanceSTT} STT`;
    } catch (err) {
        console.error("Failed to fetch STT balance", err);
        throw err;
    }
}

function convertIpfsUrl(url) {
    if (!url) {
        console.log('No URL provided to convertIpfsUrl');
        return "";
    }
    
    console.log('Converting IPFS URL:', url);
    
    if (url.startsWith('ipfs://')) {
        const ipfsPath = url.replace('ipfs://', '');
        const convertedUrl = `${IPFS_GATEWAY}${ipfsPath}`;
        console.log('Converted URL:', convertedUrl);
        return convertedUrl;
    }
    
    console.log('URL is not an IPFS URL, returning as is:', url);
    return url;
}

async function loadERC1155NFTs(address) {
    try {
        const res = await fetch(`${API_BASE}/address/${address}/balance/erc1155?page-size=100`, {
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
        console.log('ERC1155 Response:', data);
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
            const imageUrl = item.metadata?.imageUri ? convertIpfsUrl(item.metadata.imageUri) : '';
            const card = document.createElement("div");
            card.className = "col";
            card.innerHTML = `
        <div class="card h-100">
          <img src="${imageUrl}" class="card-img-top" alt="${item.metadata?.name || "NFT"}" 
               onerror="this.onerror=null; this.src='https://via.placeholder.com/300x300?text=Image+Not+Found'">
          <div class="card-body">
            <h5 class="card-title">${item.metadata?.name || "Unnamed NFT"}</h5>
            <p class="card-text">${item.metadata?.description || ""}</p>
            <p class="card-text"><strong>Token ID:</strong> ${item.tokenId}</p>
            <p class="card-text"><strong>Balance:</strong> ${item.balance}</p>
            
            <div class="mt-3">
              <div class="mb-2">
                <label for="recipient-${item.tokenId}" class="form-label">Send to Address:</label>
                <input type="text" class="form-control" id="recipient-${item.tokenId}" 
                       placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$">
              </div>
              <div class="mb-2">
                <label for="amount-${item.tokenId}" class="form-label">Amount:</label>
                <input type="number" class="form-control" id="amount-${item.tokenId}" 
                       min="1" max="${item.balance}" value="1">
              </div>
              <button class="btn btn-primary w-100" onclick="sendERC1155('${item.address}', '${item.tokenId}', '${item.balance}')">
                Send NFT
              </button>
            </div>
          </div>
        </div>
      `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to fetch ERC-1155 NFTs:", err);
        throw err;
    }
}

async function sendERC1155(contractAddress, tokenId, maxBalance) {
    try {
        const recipient = document.getElementById(`recipient-${tokenId}`).value;
        const amount = document.getElementById(`amount-${tokenId}`).value;

        // Validate inputs
        if (!ethers.utils.isAddress(recipient)) {
            alert('Please enter a valid Ethereum address');
            return;
        }

        if (amount <= 0 || amount > maxBalance) {
            alert(`Please enter a valid amount between 1 and ${maxBalance}`);
            return;
        }

        // Get the signer
        const signer = ethereumProvider.getSigner();
        
        // Create contract instance
        const contract = new ethers.Contract(
            contractAddress,
            [
                "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
            ],
            signer
        );

        // Send transaction
        const tx = await contract.safeTransferFrom(
            await signer.getAddress(),
            recipient,
            tokenId,
            amount,
            "0x" // empty bytes
        );

        // Wait for transaction to be mined
        await tx.wait();

        alert('Transfer successful!');
        
        // Refresh the wallet info to update balances
        displayWalletInfo(await signer.getAddress());
    } catch (err) {
        console.error("Transfer failed:", err);
        alert('Transfer failed: ' + (err.message || 'Unknown error'));
    }
}

async function loadERC721NFTs(address) {
    try {
        const res = await fetch(`${API_BASE}/address/${address}/balance/erc721?page-size=100`, {
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
        console.log('ERC721 Response:', data);
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
            // Convert IPFS URL before creating the card
            const imageUrl = item.metadata?.imageUri ? convertIpfsUrl(item.metadata.imageUri) : '';
            console.log('Original URL:', item.metadata?.imageUri);
            console.log('Converted URL:', imageUrl);
            
            const card = document.createElement("div");
            card.className = "col";
            card.innerHTML = `
                <div class="card h-100">
                    <img src="${imageUrl}" class="card-img-top" alt="${item.metadata?.name || "NFT"}"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/300x300?text=Image+Not+Found'">
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
        throw err;
    }
}

// Connect event listeners
document.getElementById("connectInjected").addEventListener("click", connectInjectedWallet);

// Disconnect event listener
document.getElementById("disconnectMetaMask").addEventListener("click", disconnectMetaMask);