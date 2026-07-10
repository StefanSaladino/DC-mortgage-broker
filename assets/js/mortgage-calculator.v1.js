/* =========================================================
   ONTARIO MORTGAGE CALCULATOR
   - Calculates mortgage principal and interest
   - Adds property tax, heating, and condo fees into the visible payment
   - Estimates CMHC/default insurance, Ontario/Toronto land transfer tax,
     first-time buyer rebates, stress-test payment, and GDS/TDS ratios
   - Supports amortization as a 1-35 year slider
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initMortgageCalculator();
});

function initMortgageCalculator() {
  const form = document.getElementById("mortgageCalculator");
  if (!form) return;

  const fields = form.querySelectorAll("input, select");

  fields.forEach((field) => {
    field.addEventListener("input", calculateMortgage);
    field.addEventListener("change", calculateMortgage);
  });

  calculateMortgage();
}

/** Safely reads a numeric input value by ID. */
function getNumber(id) {
  const input = document.getElementById(id);
  const value = Number(input?.value || 0);

  return Number.isFinite(value) ? value : 0;
}

/** Safely reads a checked state by ID. */
function getChecked(id) {
  const input = document.getElementById(id);
  return Boolean(input?.checked);
}

/** Formats a number as Canadian dollars. */
function formatCurrency(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Formats a number as a percentage. */
function formatPercent(value) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

/** Updates one calculator result field. */
function setResult(name, value) {
  const node = document.querySelector(`[data-result="${name}"]`);
  if (node) node.textContent = value;
}

/** Updates the visible amortization slider label. */
function updateAmortizationLabel(amortizationYears) {
  const output = document.getElementById("amortizationValue");
  if (!output) return;

  output.textContent = `${amortizationYears} ${amortizationYears === 1 ? "year" : "years"}`;
}

/**
 * Calculates the minimum down payment using current Canadian purchase rules.
 * - Up to $500,000: 5%
 * - $500,000 to $1,500,000: 5% on first $500k + 10% on the remainder
 * - $1,500,000+: 20%
 */
function calculateMinimumDownPayment(price) {
  if (price <= 0) return 0;

  if (price < 500000) {
    return price * 0.05;
  }

  if (price < 1500000) {
    return 25000 + (price - 500000) * 0.10;
  }

  return price * 0.20;
}

/**
 * Estimates CMHC/default insurance premium.
 * This is a planning estimate only.
 */
function calculateInsurancePremium(price, downPayment, amortizationYears) {
  const baseMortgage = Math.max(price - downPayment, 0);
  const downPaymentPercent = price > 0 ? downPayment / price : 0;
  const loanToValue = price > 0 ? baseMortgage / price : 0;

  if (price <= 0 || baseMortgage <= 0) return 0;

  if (price >= 1500000) return 0;

  if (downPaymentPercent >= 0.20) return 0;

  let premiumRate = 0;

  if (loanToValue > 0.90 && loanToValue <= 0.95) {
    premiumRate = 0.04;
  } else if (loanToValue > 0.85 && loanToValue <= 0.90) {
    premiumRate = 0.031;
  } else if (loanToValue > 0.80 && loanToValue <= 0.85) {
    premiumRate = 0.028;
  }

  /*
    Simple estimator note:
    Some insured mortgage scenarios with amortizations over 25 years may depend
    on borrower/property eligibility. This small premium bump keeps the preview conservative.
  */
  if (amortizationYears > 25 && premiumRate > 0) {
    premiumRate += 0.002;
  }

  return baseMortgage * premiumRate;
}

/** Calculates a standard monthly principal-and-interest mortgage payment. */
function calculateMonthlyMortgagePayment(principal, annualRatePercent, amortizationYears) {
  if (principal <= 0 || amortizationYears <= 0) return 0;

  const monthlyRate = annualRatePercent / 100 / 12;
  const numberOfPayments = amortizationYears * 12;

  if (monthlyRate <= 0) {
    return principal / numberOfPayments;
  }

  return principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numberOfPayments)));
}

/** Ontario-style land transfer tax estimate. */
function calculateLandTransferTax(price) {
  if (price <= 0) return 0;

  let tax = 0;

  const brackets = [
    { limit: 55000, rate: 0.005 },
    { limit: 250000, rate: 0.01 },
    { limit: 400000, rate: 0.015 },
    { limit: 2000000, rate: 0.02 },
    { limit: Infinity, rate: 0.025 },
  ];

  let previousLimit = 0;

  brackets.forEach((bracket) => {
    if (price > previousLimit) {
      const taxableAmount = Math.min(price, bracket.limit) - previousLimit;
      tax += taxableAmount * bracket.rate;
      previousLimit = bracket.limit;
    }
  });

  return tax;
}

/** Converts a monthly carrying amount into the selected payment frequency. */
function convertMonthlyToFrequency(monthlyAmount, frequency) {
  const paymentsPerYear = Number(frequency) || 12;

  return (monthlyAmount * 12) / paymentsPerYear;
}

/** Returns the plain-language label for the selected payment frequency. */
function getFrequencyLabel(frequency) {
  const labels = {
    12: "per month",
    24: "semi-monthly",
    26: "bi-weekly",
    52: "weekly",
  };

  return labels[frequency] || "per payment";
}

function calculateMortgage() {
  const homePrice = getNumber("homePrice");
  const enteredDownPayment = getNumber("downPayment");
  const interestRate = getNumber("interestRate");
  const amortization = getNumber("amortization");
  const frequency = getNumber("frequency");
  const annualPropertyTax = getNumber("propertyTax");
  const monthlyHeating = getNumber("heatingCost");
  const monthlyCondoFees = getNumber("condoFees");
  const monthlyDebt = getNumber("monthlyDebt");
  const grossAnnualIncome = getNumber("grossIncome");

  const isFirstTimeBuyer = getChecked("firstTimeBuyer");
  const isInToronto = getChecked("inToronto");

  updateAmortizationLabel(amortization);

  const minimumDownPayment = calculateMinimumDownPayment(homePrice);
  const effectiveDownPayment = Math.max(enteredDownPayment, minimumDownPayment);
  const downPaymentPercent = homePrice > 0 ? (enteredDownPayment / homePrice) * 100 : 0;

  const downPaymentOutput = document.getElementById("downPaymentPercent");
  if (downPaymentOutput) {
    downPaymentOutput.textContent = formatPercent(downPaymentPercent);
  }

  const insurancePremium = calculateInsurancePremium(homePrice, effectiveDownPayment, amortization);
  const baseMortgage = Math.max(homePrice - effectiveDownPayment, 0);
  const totalMortgage = baseMortgage + insurancePremium;
  const insurancePst = insurancePremium * 0.08;

  const monthlyPrincipalInterest = calculateMonthlyMortgagePayment(totalMortgage, interestRate, amortization);
  const monthlyPropertyTax = annualPropertyTax / 12;

  const totalMonthlyCarryingCost =
    monthlyPrincipalInterest +
    monthlyPropertyTax +
    monthlyHeating +
    monthlyCondoFees;

  const selectedFrequencyPayment = convertMonthlyToFrequency(totalMonthlyCarryingCost, frequency);
  const selectedFrequencyLabel = getFrequencyLabel(frequency);

  const ontarioLtt = calculateLandTransferTax(homePrice);
  const torontoLtt = isInToronto ? calculateLandTransferTax(homePrice) : 0;

  const ontarioRebate = isFirstTimeBuyer ? Math.min(4000, ontarioLtt) : 0;
  const torontoRebate = isFirstTimeBuyer && isInToronto ? Math.min(4475, torontoLtt) : 0;
  const totalRebates = ontarioRebate + torontoRebate;

  const netLandTransferTax = Math.max(ontarioLtt + torontoLtt - totalRebates, 0);
  const closingCostBuffer = 2500;
  const estimatedCashNeeded = effectiveDownPayment + netLandTransferTax + insurancePst + closingCostBuffer;

  const stressRate = Math.max(interestRate + 2, 5.25);
  const stressPayment = calculateMonthlyMortgagePayment(totalMortgage, stressRate, amortization);

  const grossMonthlyIncome = grossAnnualIncome / 12;
  const gdsMonthlyCosts = stressPayment + monthlyPropertyTax + monthlyHeating + monthlyCondoFees * 0.5;
  const tdsMonthlyCosts = gdsMonthlyCosts + monthlyDebt;

  const gdsRatio = grossMonthlyIncome > 0 ? (gdsMonthlyCosts / grossMonthlyIncome) * 100 : 0;
  const tdsRatio = grossMonthlyIncome > 0 ? (tdsMonthlyCosts / grossMonthlyIncome) * 100 : 0;

  setResult("payment", formatCurrency(selectedFrequencyPayment));
  setResult(
    "paymentLabel",
    `${selectedFrequencyLabel}, incl. mortgage, property tax, heating, and condo fees`
  );

  setResult("principalInterest", formatCurrency(monthlyPrincipalInterest));
  setResult("propertyTaxMonthly", formatCurrency(monthlyPropertyTax));
  setResult("heatingMonthly", formatCurrency(monthlyHeating));
  setResult("condoFeesMonthly", formatCurrency(monthlyCondoFees));

  setResult("minDownPayment", formatCurrency(minimumDownPayment));
  setResult("baseMortgage", formatCurrency(baseMortgage));
  setResult("insurancePremium", formatCurrency(insurancePremium));
  setResult("insurancePst", formatCurrency(insurancePst));
  setResult("totalMortgage", formatCurrency(totalMortgage));
  setResult("ontarioLtt", formatCurrency(ontarioLtt));
  setResult("torontoLtt", formatCurrency(torontoLtt));
  setResult("rebates", `-${formatCurrency(totalRebates)}`);
  setResult("cashNeeded", formatCurrency(estimatedCashNeeded));
  setResult("stressRate", `${stressRate.toFixed(2)}%`);
  setResult("stressPayment", formatCurrency(stressPayment));
  setResult("debtRatios", `${formatPercent(gdsRatio)} / ${formatPercent(tdsRatio)}`);

  const warnings = [];

  if (enteredDownPayment < minimumDownPayment) {
    warnings.push(
      `The entered down payment is below the estimated minimum. This preview uses ${formatCurrency(minimumDownPayment)} for the calculation.`
    );
  }

  if (homePrice >= 1500000 && enteredDownPayment < homePrice * 0.20) {
    warnings.push("Homes at or above $1.5M generally require at least 20% down.");
  }

  if (amortization > 25 && insurancePremium > 0) {
    warnings.push("Insured amortizations over 25 years may depend on borrower and property eligibility.");
  }

  const warningBox = document.querySelector('[data-result="warnings"]');

  if (warningBox) {
    if (warnings.length) {
      warningBox.hidden = false;
      warningBox.innerHTML = warnings.map((warning) => `<p>${warning}</p>`).join("");
    } else {
      warningBox.hidden = true;
      warningBox.innerHTML = "";
    }
  }
}