/* =========================================================
   ONTARIO MORTGAGE CALCULATOR
   Educational estimate only. Confirm exact qualification, tax,
   insurance, and closing-cost treatment with a licensed professional.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initMortgageCalculator();
});

function initMortgageCalculator() {
  const form = document.getElementById("mortgageCalculator");
  if (!form) return;

  const inputs = form.querySelectorAll("input, select");
  inputs.forEach((input) => input.addEventListener("input", updateCalculator));
  inputs.forEach((input) => input.addEventListener("change", updateCalculator));

  updateCalculator();
}

function updateCalculator() {
  const homePrice = getNumber("homePrice");
  const enteredDownPayment = getNumber("downPayment");
  const rate = getNumber("interestRate") / 100;
  const amortizationYears = getNumber("amortization");
  const paymentsPerYear = getNumber("frequency");
  const propertyTaxAnnual = getNumber("propertyTax");
  const heatingMonthly = getNumber("heatingCost");
  const condoMonthly = getNumber("condoFees");
  const otherDebtMonthly = getNumber("monthlyDebt");
  const grossIncomeAnnual = getNumber("grossIncome");
  const firstTimeBuyer = getChecked("firstTimeBuyer");
  const newBuild = getChecked("newBuild");
  const inToronto = getChecked("inToronto");

  const warnings = [];
  const minDownPayment = calculateMinimumDownPayment(homePrice);
  const downPayment = Math.max(enteredDownPayment, minDownPayment);
  const downPaymentPercent = homePrice > 0 ? downPayment / homePrice : 0;

  if (enteredDownPayment < minDownPayment) {
    warnings.push(`Entered down payment is below the estimated minimum. Calculations use ${formatCurrency(minDownPayment)}.`);
  }

  if (homePrice >= 1500000 && downPaymentPercent < 0.2) {
    warnings.push("Homes priced at $1.5M or more generally require at least 20% down and are not eligible for default-insured financing.");
  }

  if (downPaymentPercent < 0.2 && amortizationYears === 30 && !firstTimeBuyer && !newBuild) {
    warnings.push("A 30-year insured amortization may only be available for eligible first-time buyers or new builds. Confirm eligibility before relying on this estimate.");
  }

  const baseMortgage = Math.max(homePrice - downPayment, 0);
  const insurancePremium = calculateInsurancePremium(homePrice, baseMortgage, downPaymentPercent);
  const insurancePst = insurancePremium * 0.08;
  const totalMortgage = baseMortgage + insurancePremium;

  const payment = calculateCanadianMortgagePayment(totalMortgage, rate, amortizationYears, paymentsPerYear);
  const stressRate = Math.max(rate + 0.02, 0.0525);
  const stressPayment = calculateCanadianMortgagePayment(totalMortgage, stressRate, amortizationYears, paymentsPerYear);
  const stressMonthlyEquivalent = stressPayment * paymentsPerYear / 12;

  const ontarioLttGross = calculateOntarioLandTransferTax(homePrice);
  const torontoLttGross = inToronto ? calculateTorontoMunicipalLandTransferTax(homePrice) : 0;
  const ontarioRebate = firstTimeBuyer ? Math.min(ontarioLttGross, 4000) : 0;
  const torontoRebate = firstTimeBuyer && inToronto ? Math.min(torontoLttGross, 4475) : 0;
  const totalRebates = ontarioRebate + torontoRebate;

  const lttAfterRebate = Math.max(ontarioLttGross + torontoLttGross - totalRebates, 0);
  const closingCostBuffer = 2500;
  const cashNeeded = downPayment + lttAfterRebate + insurancePst + closingCostBuffer;

  const monthlyIncome = grossIncomeAnnual / 12;
  const housingCosts = stressMonthlyEquivalent + propertyTaxAnnual / 12 + heatingMonthly + condoMonthly * 0.5;
  const gds = monthlyIncome > 0 ? housingCosts / monthlyIncome : 0;
  const tds = monthlyIncome > 0 ? (housingCosts + otherDebtMonthly) / monthlyIncome : 0;

  updateText("payment", formatCurrency(payment));
  updateText("paymentLabel", `${getFrequencyLabel(paymentsPerYear)}, principal & interest`);
  updateText("minDownPayment", formatCurrency(minDownPayment));
  updateText("baseMortgage", formatCurrency(baseMortgage));
  updateText("insurancePremium", formatCurrency(insurancePremium));
  updateText("insurancePst", formatCurrency(insurancePst));
  updateText("totalMortgage", formatCurrency(totalMortgage));
  updateText("ontarioLtt", formatCurrency(Math.max(ontarioLttGross - ontarioRebate, 0)));
  updateText("torontoLtt", inToronto ? formatCurrency(Math.max(torontoLttGross - torontoRebate, 0)) : "$0");
  updateText("rebates", `-${formatCurrency(totalRebates)}`);
  updateText("cashNeeded", formatCurrency(cashNeeded));
  updateText("stressRate", `${(stressRate * 100).toFixed(2)}%`);
  updateText("stressPayment", formatCurrency(stressPayment));
  updateText("debtRatios", `${formatPercent(gds)} / ${formatPercent(tds)}`);

  const percentOutput = document.getElementById("downPaymentPercent");
  if (percentOutput) percentOutput.textContent = `${(downPaymentPercent * 100).toFixed(1)}%`;

  const warningNode = document.querySelector('[data-result="warnings"]');
  if (warningNode) {
    warningNode.hidden = warnings.length === 0;
    warningNode.innerHTML = warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("");
  }
}

function getNumber(id) {
  const node = document.getElementById(id);
  if (!node) return 0;
  const value = Number(node.value);
  return Number.isFinite(value) ? value : 0;
}

function getChecked(id) {
  const node = document.getElementById(id);
  return Boolean(node && node.checked);
}

function updateText(resultName, value) {
  const node = document.querySelector(`[data-result="${resultName}"]`);
  if (node) node.textContent = value;
}

function calculateMinimumDownPayment(price) {
  if (price <= 0) return 0;
  if (price <= 500000) return price * 0.05;
  if (price < 1500000) return 25000 + (price - 500000) * 0.1;
  return price * 0.2;
}

function calculateInsurancePremium(price, mortgageBeforeInsurance, downPaymentPercent) {
  if (price <= 0 || mortgageBeforeInsurance <= 0) return 0;
  if (downPaymentPercent >= 0.2) return 0;
  if (price >= 1500000) return 0;

  const loanToValue = mortgageBeforeInsurance / price;
  let premiumRate = 0;

  if (loanToValue <= 0.65) premiumRate = 0.006;
  else if (loanToValue <= 0.75) premiumRate = 0.017;
  else if (loanToValue <= 0.8) premiumRate = 0.024;
  else if (loanToValue <= 0.85) premiumRate = 0.028;
  else if (loanToValue <= 0.9) premiumRate = 0.031;
  else if (loanToValue <= 0.95) premiumRate = 0.04;
  else return 0;

  return mortgageBeforeInsurance * premiumRate;
}

function calculateCanadianMortgagePayment(principal, annualRate, years, paymentsPerYear) {
  if (principal <= 0 || years <= 0 || paymentsPerYear <= 0) return 0;
  const totalPayments = years * paymentsPerYear;

  if (annualRate <= 0) return principal / totalPayments;

  const periodRate = Math.pow(1 + annualRate / 2, 2 / paymentsPerYear) - 1;
  return principal * (periodRate / (1 - Math.pow(1 + periodRate, -totalPayments)));
}

function calculateOntarioLandTransferTax(price) {
  const brackets = [
    [55000, 0.005],
    [250000, 0.01],
    [400000, 0.015],
    [2000000, 0.02],
    [Infinity, 0.025],
  ];

  return calculateMarginalTax(price, brackets);
}

function calculateTorontoMunicipalLandTransferTax(price) {
  const brackets = [
    [55000, 0.005],
    [250000, 0.01],
    [400000, 0.015],
    [2000000, 0.02],
    [3000000, 0.025],
    [4000000, 0.035],
    [5000000, 0.045],
    [10000000, 0.055],
    [20000000, 0.065],
    [Infinity, 0.075],
  ];

  return calculateMarginalTax(price, brackets);
}

function calculateMarginalTax(amount, brackets) {
  let tax = 0;
  let previousLimit = 0;

  for (const [limit, rate] of brackets) {
    if (amount <= previousLimit) break;

    const taxableAmount = Math.min(amount, limit) - previousLimit;
    tax += taxableAmount * rate;
    previousLimit = limit;
  }

  return Math.max(tax, 0);
}

function getFrequencyLabel(paymentsPerYear) {
  switch (paymentsPerYear) {
    case 52:
      return "per week";
    case 26:
      return "bi-weekly";
    case 24:
      return "semi-monthly";
    default:
      return "per month";
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}