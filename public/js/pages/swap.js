import api from "../api.js";
import { toast, formatCurrency } from "../app.js";

const COINS = [
    {
        id: "btc",
        name: "Bitcoin",
        logo: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
    },
    {
        id: "eth",
        name: "Ethereum",
        logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png"
    },
    {
        id: "usdt",
        name: "Tether",
        logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png"
    },
    {
        id: "usdc",
        name: "USD Coin",
        logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
    },
    {
        id: "bnb",
        name: "BNB",
        logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png"
    },
    {
        id: "sol",
        name: "Solana",
        logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png"
    },
    {
        id: "trx",
        name: "TRON",
        logo: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png"
    },
    {
        id: "xrp",
        name: "XRP",
        logo: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png"
    },
    {
        id: "ltc",
        name: "Litecoin",
        logo: "https://assets.coingecko.com/coins/images/2/small/litecoin.png"
    },
    {
        id: "doge",
        name: "Dogecoin",
        logo: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png"
    }
];

let wallet = null;
let prices = null;

export async function render(container) {

    container.innerHTML = `
        <div class="page-inner">

            <div class="page-header">
                <div>
                    <h1 class="page-title">Swap Crypto</h1>
                    <p class="page-subtitle">
                        Convert your balance or crypto instantly.
                    </p>
                </div>
            </div>

            <div class="card swap-card">

            <div class="card-body">

                <h2 class="payment-title">
                    Swap Cryptocurrency
                </h2>

                <p class="payment-subtitle">
                    Convert your balance or crypto instantly.
                </p>

                    <div class="card" style="margin-bottom:18px;">
                        <div class="card-body">

                            <label class="input-label">
                                From
                            </label>

                            <select
                                id="swapFrom"
                                class="input-field">

                            <option value="balance">
                                Main Balance
                            </option>

                            ${COINS.map(c=>`
                                <option value="${c.id}">
                                ${c.name} (${c.id.toUpperCase()})
                                </option>
                                `)
                            .join("")}

                        </select>
                        </div>
                    </div>

                    <div style="display:flex;justify-content:center;margin:16px 0;">

    <button
        id="swapDirectionBtn"
        class="btn btn-secondary"
        style="
            width:48px;
            height:48px;
            border-radius:50%;
            padding:0;
            font-size:20px;
        ">

        ⇅

    </button>

</div>

                    <div class="card" style="margin-bottom:18px;">
                        <div class="card-body">

                            <label class="input-label">
                                To
                            </label>

                            <select
                                id="swapTo"
                                class="input-field">

                            ${COINS.map(c=>`
                                <option value="${c.id}">
                                    ${c.id.toUpperCase()}
                                </option>
                            `).join("")}

                            <option value="balance">
                                Main Balance
                            </option>

                        </select>
                        </div>
                    </div>

                    <div class="card" style="margin-bottom:18px;">
                        <div class="card-body">

                            <label class="input-label">
                                Amount
                            </label>

                            <div class="amount-input-wrap">

                                <span class="amount-prefix">$</span>

                                <input
                                    id="swapAmount"
                                    class="amount-input"
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0.00">

                            </div>

                        </div>
                    </div>

                    <div
                        id="swapPreview"
                        style="margin:20px 0;color:#64748b;">
                    </div>

                    <button
                        id="swapBtn"
                        class="btn btn-primary btn-w100">

                        Swap Crypto →

                    </button>

                    <hr style="
                    margin:32px 0;
                    border:none;
                    border-top:1px solid #e5e7eb;
                    ">

                    <div
                        id="walletBalances"
                        style="margin-top:0;">
                    </div>

                </div>

            </div>

        </div>
    `;

    await load();

}

async function load() {

    const data = await api.portfolio();

wallet = {
    ...data.wallet,
    balance: Number(data.balance)
};
console.log(wallet);

prices = data.prices;

    renderBalances();

    document.getElementById("swapAmount").oninput = updatePreview;
    document.getElementById("swapFrom").onchange = updatePreview;
    document.getElementById("swapTo").onchange = updatePreview;

    document.getElementById("swapBtn").onclick = doSwap;

    document.getElementById("swapDirectionBtn").onclick = () => {

        const from = document.getElementById("swapFrom");
        const to = document.getElementById("swapTo");
    
        const temp = from.value;
    
        from.value = to.value;
        to.value = temp;
    
        updatePreview();
    
    };

    updatePreview();

}

function renderBalances() {

    document.getElementById("walletBalances").innerHTML = `

        <h3 style="margin-bottom:18px;">
            Your Assets
        </h3>

        <div class="card">

    <div class="card-body">

        <h3 style="margin-bottom:18px;">
            Portfolio
        </h3>

        <div class="profile-row">

            <span style="
    display:flex;
    align-items:center;
    gap:12px;
    font-weight:500;
">

    <img
        src="/logos/logo.png"
        width="40"
        height="40"
        style="border-radius:50%;">

    <div>

        <div>Main Balance</div>

        <small style="color:#94a3b8;">
            USD
        </small>

    </div>

</span>

            <div style="text-align:right;">

    <strong class="green">
        ${formatCurrency(wallet.balance || 0)}
    </strong>

    <div style="
        font-size:12px;
        color:#94a3b8;
        margin-top:4px;
    ">

        Available

    </div>

</div>

        </div>

        <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;">

        ${COINS.map(c => `

            <div class="profile-row">

                <span style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                    font-weight:500;
                ">

                    <img
    src="${c.logo}"
    style="
        width:30px;
        height:30px;
        border-radius:50%;
        object-fit:cover;
        overflow:hidden;
    ">

                    <div>

                        <div>${c.name}</div>

                        <small style="color:#94a3b8;">
                            ${c.id.toUpperCase()}
                        </small>

                    </div>

                </span>

                <div style="
    text-align:right;
">

    <strong>

        ${Number(wallet[c.id] || 0).toFixed(8)}

    </strong>

    <div style="
        font-size:12px;
        color:#94a3b8;
        margin-top:4px;
    ">

        ${formatCurrency(
            (Number(wallet[c.id] || 0)) * (prices?.[c.id] || 0)
        )}

    </div>

</div>

            </div>

        `).join("")}

    </div>

</div>
    `;

}

function updatePreview() {

    const from =
        document.getElementById("swapFrom").value;

    const to =
        document.getElementById("swapTo").value;

    const amount =
        Number(
            document.getElementById("swapAmount").value
        );

    if(!amount || amount<=0){

        document.getElementById("swapPreview").innerHTML="";
        return;

    }

    if (from === to) {

        document.getElementById("swapPreview").innerHTML = `
    
            <div class="card">
    
                <div class="card-body">
    
                    <strong style="color:#ef4444;">
    
                        Please choose two different assets.
    
                    </strong>
    
                </div>
    
            </div>
    
        `;
    
        document.getElementById("swapBtn").disabled = true;
    
        return;
    
    }
    
    document.getElementById("swapBtn").disabled = false;

    let usd;

    if(from==="balance")
        usd=amount;
    else
        usd=amount*prices[from];

    const fee=usd*0.005;

    const afterFee=usd-fee;

    let receive;

    if(to==="balance")
        receive=afterFee;
    else
        receive=afterFee/prices[to];

        document.getElementById("swapPreview").innerHTML = `

        <div class="card">
        
            <div class="card-body">
        
                <h3 style="margin-bottom:16px;">
                    Swap Preview
                </h3>
        
                <div class="profile-row">
        
                    <span>Network / Swap Fee</span>
        
                    <strong>${formatCurrency(fee)}</strong>
        
                </div>
        
                <div class="profile-row">
        
                    <span>You Receive</span>
        
                    <strong class="green">
        
                        ${
                            to === "balance"
                            ? formatCurrency(receive)
                            : receive.toFixed(8) + " " + to.toUpperCase()
                        }
        
                    </strong>
        
                </div>
        
            </div>
        
        </div>
        
        `;

}

async function doSwap(){

    try{

        const from=
            document.getElementById("swapFrom").value;

        const to=
            document.getElementById("swapTo").value;

        const amount=
            Number(
                document.getElementById("swapAmount").value
            );

        if(amount<=0){

            toast("Enter an amount","error");
            return;

        }

        const result = await api.swap(
            from,
            to,
            amount
        );
        
        wallet = result.wallet;
        wallet.balance = result.balance;
        
        renderBalances();
        
        toast(
            "Swap completed",
            "success"
        );
        
        document.getElementById("swapAmount").value = "";
        
        updatePreview();

        document.getElementById("swapAmount").value="";

        updatePreview();

    }

    catch(err){

        toast(
            err.message,
            "error"
        );

    }

}