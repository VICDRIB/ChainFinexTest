import api from "../api.js";
import { formatCurrency, navigate } from "../app.js";

const COINS = [
    {
        symbol: "btc",
        coinId: "bitcoin",
        name: "Bitcoin",
        logo: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
    },
    {
        symbol: "eth",
        coinId: "ethereum",
        name: "Ethereum",
        logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png"
    },
    {
        symbol: "usdt",
        coinId: "tether",
        name: "Tether",
        logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png"
    },
    {
        symbol: "usdc",
        coinId: "usd-coin",
        name: "USD Coin",
        logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
    },
    {
        symbol: "bnb",
        coinId: "binancecoin",
        name: "BNB",
        logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png"
    },
    {
        symbol: "sol",
        coinId: "solana",
        name: "Solana",
        logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png"
    },
    {
        symbol: "trx",
        coinId: "tron",
        name: "TRON",
        logo: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png"
    },
    {
        symbol: "xrp",
        coinId: "ripple",
        name: "XRP",
        logo: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png"
    },
    {
        symbol: "ltc",
        coinId: "litecoin",
        name: "Litecoin",
        logo: "https://assets.coingecko.com/coins/images/2/small/litecoin.png"
    },
    {
        symbol: "doge",
        coinId: "dogecoin",
        name: "Dogecoin",
        logo: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png"
    }
];

export async function render(container) {

    container.innerHTML = `
    <div class="page-inner">

        <div class="page-header">

            <button
                class="btn"
                onclick="history.back()">

                ← Back

            </button>

            <div>

                <h1 class="page-title">
                    Portfolio
                </h1>

                <p class="page-subtitle">
                    Your complete portfolio allocation
                </p>

            </div>

        </div>

        <div id="portfolioContent">

            Loading...

        </div>

    </div>
    `;

    loadPortfolio();

}

async function loadPortfolio() {

    const data = await api.portfolio();
    console.log("Portfolio API:", data);

    const balance = Number(data.balance);

    const wallet = data.wallet || {};

    const prices = data.prices || {};

    let total = balance;

    const assets = [];

    assets.push({
        name: "Main Balance",
        logo: "/logos/logo.png",
        amount: balance,
        value: balance,
        symbol: "USD"
    });

    COINS.forEach(c => {

        const amount = Number(wallet[c.symbol] || 0);

        if (!amount)
            return;

        const value = amount * (prices[c.symbol] || 0);

        total += value;

        assets.push({
            ...c,
            amount,
            value
        });

    });

    assets.forEach(a => {

        a.percent = total
            ? (a.value / total) * 100
            : 0;

    });

    document.getElementById("portfolioContent").innerHTML = `

        <div class="card">

            <div class="card-body">

                <h2 style="margin-bottom:8px;">

                    Total Portfolio

                </h2>

                <div
                    style="
                        font-size:40px;
                        font-weight:700;
                        margin-bottom:30px;
                    ">

                    ${formatCurrency(total)}

                </div>

                <canvas
                    id="portfolioChart"
                    height="260">
                </canvas>

            </div>


            <div class="portfolio-actions">

    <button class="btn btn-primary" id="portfolioDeposit">
        Deposit
    </button>

    <button class="btn btn-primary" id="portfolioInvest">
        Invest
    </button>

    <button class="btn btn-primary" id="portfolioSwap">
        Swap
    </button>

    <button class="btn btn-primary" id="portfolioWithdraw">
        Withdraw
    </button>

</div>



        </div>

        <div class="card" style="margin-top:25px;">

            <div class="card-header">

                <div class="card-title">

                    Portfolio Allocation

                </div>

            </div>

            <div class="card-body">

                ${assets.map(a=>`

                    <div
                        class="profile-row portfolio-row"
                        style="
                        padding:15px 0;
                        border-bottom:1px solid #eee;
                        cursor:pointer;
                    "
                    ${
                        a.coinId
                            ? `onclick="window.navigate('/crypto/${a.coinId}')"`
                            : ""
                    }>

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                gap:12px;
                            ">

                            <div
                                style="
                                    font-size:28px;
                                    width:40px;
                                ">

                                <img
                                    src="${a.logo}"
                                    style="
                                        width:34px;
                                        height:34px;
                                        border-radius:${a.name === "Main Balance" ? "8px" : "50%"};
                                        object-fit:cover;
                                        overflow:hidden;
                                    ">

                            </div>

                            <div>

                                <strong>

                                    ${a.name}

                                </strong>

                                <br>

                                <small>

                                    ${a.amount.toFixed(8)}

                                </small>

                            </div>

                        </div>

                        <div
                            style="
                                text-align:right;
                            ">

                            <strong>

                                ${formatCurrency(a.value)}

                            </strong>

                            <br>

                            <span
                                style="
                                    color:#64748b;
                                ">

                                ${a.percent.toFixed(2)}%

                            </span>

                        </div>

                    </div>

                `).join("")}

            </div>

        </div>

    `;

    renderChart(assets);

    document.getElementById("portfolioDeposit").onclick =
    () => navigate("/payments");

document.getElementById("portfolioInvest").onclick =
    () => navigate("/trading-plans");

document.getElementById("portfolioSwap").onclick =
    () => navigate("/swap");

document.getElementById("portfolioWithdraw").onclick =
    () => navigate("/withdraw");

}

function renderChart(assets){

    new Chart(

        document.getElementById("portfolioChart"),

        {

            type:"doughnut",

            data:{

                labels:assets.map(a=>a.name),

                datasets: [{
                    data: assets.map(a => a.value),
                    backgroundColor: [
                        "#f7931a", // Bitcoin
                        "#627eea", // Ethereum
                        "#26a17b", // USDT
                        "#2775ca", // USDC
                        "#f3ba2f", // BNB
                        "#14f195", // Solana
                        "#ff060a", // TRON
                        "#23292f", // XRP
                        "#345c9c", // Litecoin
                        "#c2a633", // Dogecoin
                        "#3b82f6"  // Main Balance
                    ],
                    borderWidth: 0,
                    hoverOffset: 12
                }]

            },

            options: {

                responsive: true,
            
                cutout: "70%",
            
                plugins: {
            
                    legend: {
            
                        position: "bottom",
            
                        labels: {
            
                            usePointStyle: true,
                            pointStyle: "circle",
                            padding: 20
            
                        }
            
                    }
            
                }
            
            }

        }

    );

}