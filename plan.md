Build a polished proof-of-concept web application called **PharmaLaunch AI — Drug Launch Strategy Simulator**.

The application is a **business decision-support and simulation platform for pharmaceutical product launches**.

This is NOT a clinical decision system and must not recommend drugs to patients or make medical claims. All drugs, market data, patient data, doctor profiles, and commercial outcomes in this prototype should be clearly labeled as **fictional or simulated**.

The goal of the prototype is to let a pharmaceutical strategy or marketing team configure a hypothetical drug launch, simulate how doctors, patients, competitors, pricing, insurance coverage, and marketing decisions interact over time, and compare the commercial outcomes of different launch strategies.

---

# 1. Core product idea

Pharmaceutical companies must make several important decisions before launching a new drug:

* What should the launch price be?
* How much should be spent on marketing?
* How much should be invested in physician outreach?
* What patient segments should be targeted?
* How important is insurance coverage?
* What happens if a competitor reduces its price?
* How quickly will doctors begin prescribing the new drug?
* How quickly will patients adopt it?
* When will the launch break even?
* Which combination of pricing and marketing produces the strongest commercial outcome?

The application should allow the user to experiment with these variables and simulate their effects.

The primary experience should feel like a **strategy sandbox**, not just a static analytics dashboard.

---

# 2. Demo scenario

Create one fictional drug for the prototype.

Drug name:

**GlucoNova**

Therapy area:

**Type-2 diabetes**

Description:

GlucoNova is a fictional oral therapy entering a competitive chronic-care market.

All clinical attributes should be fictional and simplified for simulation purposes.

Default market:

* Eligible patient population: 100,000
* Simulated physicians: 500
* Competitors: 3
* Simulation duration: 24 months
* Geographic market: fictional Indian urban market
* Currency: INR

The prototype must prominently say:

"All market, patient, physician, competitor, and financial data shown in this application are simulated and for demonstration purposes only."

---

# 3. Main application screens

Build the application with five major areas:

1. Strategy Configuration
2. Simulation Dashboard
3. Scenario Comparison
4. Sensitivity Analysis
5. AI Strategy Summary

The user should be able to navigate between them without reloading the page.

---

# 4. Strategy Configuration screen

This is where the user defines the launch strategy.

Create an intuitive control panel with sliders, number inputs, select menus, and toggles.

Include the following inputs.

## Market assumptions

Eligible patient population

Default:
100,000

Range:
25,000 to 500,000

Number of physicians

Default:
500

Range:
100 to 5,000

Simulation duration

Options:
12 months
18 months
24 months
36 months

Default:
24 months

---

## Drug strategy

Monthly drug price

Default:
₹1,600

Range:
₹500 to ₹3,000

Expected perceived clinical differentiation

Options:
Low
Medium
High

This is only a simulation variable representing how differentiated physicians perceive the fictional product to be.

Default:
Medium

Convenience advantage

Options:
Low
Medium
High

Default:
Medium

Patient adherence attractiveness

Options:
Low
Medium
High

Default:
Medium

---

## Marketing strategy

Total marketing budget

Default:
₹80 lakh

Range:
₹10 lakh to ₹5 crore

Consumer awareness allocation

Default:
30%

Physician marketing allocation

Default:
45%

Digital campaign allocation

Default:
15%

Other marketing

Default:
10%

Make sure allocations total 100%.

---

## Physician outreach

Sales representatives

Default:
25

Range:
5 to 150

Physician outreach intensity

Options:
Low
Medium
High

Default:
Medium

Educational events per quarter

Default:
5

Range:
0 to 30

---

## Patient accessibility

Insurance coverage

Default:
55%

Range:
0% to 100%

Patient discount/rebate

Default:
5%

Range:
0% to 40%

Patient affordability support

Options:
None
Basic
Strong

Default:
Basic

---

## Competition

Create three fictional competitors:

Competitor A:
DiaCare
Price ₹1,300
Market share 40%

Competitor B:
GlucoEase
Price ₹1,700
Market share 35%

Competitor C:
MetraPlus
Price ₹900
Market share 25%

Allow competitor strength to be set as:

Weak
Moderate
Strong

Allow the user to enable a future competitor event such as:

"Competitor reduces price by 20% in Month 8"

and

"Competitor increases marketing by 30% in Month 12"

---

# 5. Simulated physician population

Generate a synthetic physician population.

Each physician should have the following attributes:

physician_id

patient_volume

innovation_tendency

price_sensitivity

evidence_sensitivity

brand_familiarity

peer_influence

marketing_responsiveness

specialty_type

current_competitor_preference

launch_awareness

prescription_probability

Use realistic-looking but fully synthetic values.

Suggested distributions:

patient_volume:
50 to 500 patients per month

innovation_tendency:
0 to 1

price_sensitivity:
0 to 1

evidence_sensitivity:
0 to 1

peer_influence:
0 to 1

marketing_responsiveness:
0 to 1

launch_awareness:
initially 0.05 to 0.25

Create physician segments such as:

Innovators
Early adopters
Mainstream physicians
Price-sensitive physicians
Traditionalists

Display the physician segment distribution somewhere in the dashboard.

---

# 6. Simulated patient population

Generate a synthetic patient population.

For performance, the application can simulate 5,000 to 20,000 virtual patients and scale results to the full eligible population.

Each patient should have:

patient_id

age

income_segment

insurance_status

price_sensitivity

brand_awareness

treatment_willingness

doctor_influence

digital_engagement

affordability_score

competitor_loyalty

adoption_probability

adoption_status

income_segment options:

Low
Lower-middle
Upper-middle
High

Insurance status:

Covered
Partially covered
Not covered

The synthetic data should be generated deterministically using a fixed random seed so results are reproducible.

---

# 7. Physician adoption model

Build a simplified physician prescription probability model.

Use a logistic/sigmoid-based equation.

Example structure:

physician_score =
1.1 × drug_differentiation

* 0.9 × physician_awareness
* 0.8 × marketing_exposure
* 0.7 × peer_influence
* 0.6 × convenience_advantage
* 0.5 × innovation_tendency

- 0.8 × price_concern
- 0.7 × competitor_strength

Then:

prescription_probability =
sigmoid(physician_score + intercept)

Normalize all input values to approximately 0 to 1.

Do not claim the coefficients are scientifically validated.

Label them:

"Simulation coefficients chosen for illustrative purposes."

---

# 8. Patient adoption model

Patient adoption should depend on:

doctor recommendation

insurance coverage

effective out-of-pocket price

brand awareness

treatment willingness

affordability

competitor loyalty

marketing exposure

Create a formula similar to:

patient_score =
1.3 × doctor_recommendation

* 0.9 × insurance_factor
* 0.7 × awareness
* 0.6 × affordability
* 0.5 × treatment_willingness
* 0.4 × marketing_exposure

- 1.0 × effective_price_sensitivity
- 0.6 × competitor_loyalty

Then:

adoption_probability =
sigmoid(patient_score + intercept)

Apply randomness using a seeded pseudo-random generator.

---

# 9. Month-by-month simulation

Simulate the market month by month.

For every month:

1. Calculate marketing exposure.
2. Update physician awareness.
3. Update physician prescribing probability.
4. Update patient awareness.
5. Calculate patient adoption probabilities.
6. Determine newly adopted patients.
7. Calculate active patients.
8. Calculate market share.
9. Calculate revenue.
10. Calculate marketing spend.
11. Calculate operating contribution.
12. Check competitor events.
13. Store monthly metrics.

Run the simulation for the selected duration.

---

# 10. Awareness dynamics

Marketing should gradually increase awareness.

For physicians:

new_awareness =
old_awareness

* physician_marketing_effect
* peer_effect

- awareness_decay

Clamp between 0 and 1.

For patients:

new_awareness =
old_awareness

* consumer_marketing_effect
* digital_marketing_effect
* physician_effect

- awareness_decay

Clamp between 0 and 1.

Marketing effects should show diminishing returns.

For example:

marketing_effect =
1 - exp(-k × marketing_spend)

Use sensible scaling constants so increasing marketing helps, but doubling budget does not automatically double adoption.

---

# 11. Price and affordability

Calculate effective patient price.

effective_price =
monthly_price
× (1 - insurance_support)
× (1 - patient_discount)

Insurance support can vary depending on patient insurance status.

Examples:

Covered:
70% support

Partially covered:
35% support

Not covered:
0%

These are fictional simulation assumptions.

Affordability should depend on:

patient income segment

effective price

patient price sensitivity

A higher price should generally reduce adoption among price-sensitive segments.

---

# 12. Competitor behavior

Competitors should influence adoption.

Create competitor pressure based on:

competitor market share

competitor price

competitor marketing strength

competitor loyalty

Allow scenario events.

Examples:

Month 8:
Competitor price decreases 20%.

Month 12:
Competitor marketing intensity increases 30%.

Month 16:
New generic competitor enters the market.

When an event occurs, show it visibly on the simulation timeline.

---

# 13. Financial model

Calculate the following.

Monthly revenue:

active_patients × monthly_price

Net revenue can optionally account for discount:

active_patients × effective_net_price

Marketing cost:

marketing_budget allocated across months

Salesforce cost:

number_of_reps × monthly_rep_cost

Assume a fictional rep cost such as:

₹85,000 per representative per month

Other launch cost:

fixed launch cost

Default:
₹1.5 crore

Calculate:

gross revenue

marketing expenditure

salesforce expenditure

total launch cost

cumulative revenue

cumulative profit/contribution

break-even month

marketing ROI

Revenue values must be clearly marked as simulated commercial projections.

---

# 14. Key output metrics

Show prominent KPI cards for:

Market share

Active patients

New patients this month

Physician adoption rate

Patient awareness

Physician awareness

Cumulative revenue

Marketing ROI

Break-even month

Customer acquisition cost

Marketing cost per acquired patient

Average monthly growth rate

---

# 15. Simulation Dashboard

After clicking:

**Run Simulation**

show a visually strong dashboard.

Include:

### Adoption curve

Line chart:

Month vs active patients

### Market share

Line chart:

Month vs GlucoNova market share

Optionally compare competitor market shares.

### Revenue

Monthly revenue line or bar chart.

### Physician adoption

Percentage of simulated physicians prescribing GlucoNova over time.

### Patient funnel

Display a funnel:

Eligible patients

Aware patients

Patients whose doctors prescribe

Patients considering treatment

Adopted patients

Retained active patients

### Marketing efficiency

Show:

Marketing spend

Patients acquired

Cost per acquired patient

Marketing ROI

---

# 16. Patient segment analytics

Break adoption down by:

Income segment

Insurance status

Age group

Price sensitivity

Digital engagement

Show results such as:

"Upper-middle-income insured patients show the highest simulated adoption."

"Price-sensitive uninsured patients show the lowest simulated conversion."

Do not use these statements as medical claims.

They should purely describe simulated commercial behavior.

---

# 17. Physician segment analytics

Show adoption by physician type.

Example:

Innovators
72% prescribing

Early adopters
58%

Mainstream
36%

Price-sensitive
22%

Traditionalists
12%

These numbers should be generated by the simulation, not hardcoded.

---

# 18. Scenario saving

Allow the user to save the current configuration as a scenario.

Examples:

Scenario A:
Premium Launch

Scenario B:
Balanced Launch

Scenario C:
Market Penetration

Allow a maximum of 5 saved scenarios.

Store them locally in application state.

No authentication is needed.

---

# 19. Scenario Comparison page

Create a comparison table.

Columns:

Metric
Premium Launch
Balanced Launch
Market Penetration

Rows:

Price

Marketing spend

Insurance coverage

Physician outreach

Patient adoption

Market share

Active patients

Revenue

Profit

Break-even month

Marketing ROI

Cost per acquisition

Also include charts comparing:

Market share over time

Revenue over time

Patient adoption over time

Do not automatically declare one strategy to be universally "best."

Instead show trade-offs.

For example:

"Scenario A generates higher margin per patient, while Scenario C achieves faster adoption."

---

# 20. Sensitivity analysis

Create a dedicated sensitivity-analysis feature.

The user chooses one variable.

Options:

Price

Marketing budget

Insurance coverage

Physician outreach

Consumer marketing share

Discount rate

Competitor strength

The application runs multiple simulations while varying only that parameter.

Example:

Price test:

₹800
₹1,000
₹1,200
₹1,400
₹1,600
₹1,800
₹2,000
₹2,200
₹2,400

Plot:

Price vs market share

Price vs revenue

Price vs profit

Price vs adoption

This should demonstrate how commercial outcomes change when one strategic variable changes.

---

# 21. Optional optimization mode

Add a button:

**Find Efficient Strategy**

Do not present the answer as a guaranteed real-world optimum.

Run a grid search across simulated values.

For example:

Price:
₹1,000 to ₹2,200

Marketing:
₹40 lakh to ₹1.5 crore

Insurance support:
30% to 70%

Doctor outreach:
Low / Medium / High

Calculate a synthetic objective score based on:

profit

market share

ROI

patient adoption

Then identify several efficient trade-off strategies.

Show:

Highest simulated revenue strategy

Highest simulated adoption strategy

Lowest acquisition-cost strategy

Fastest simulated break-even strategy

Do not label any one overall strategy as universally best.

---

# 22. AI Strategy Summary

Add a panel called:

**AI Strategy Analyst**

This does not need a real LLM API for the initial prototype.

Generate rule-based textual insights from the simulation.

Examples:

"Physician awareness increased strongly during the first six months, but patient adoption remained constrained by affordability."

"Reducing price by 10% produced a larger simulated increase in adoption than increasing marketing expenditure by 20%."

"High adoption among insured patients suggests simulated market access is a major driver of launch performance."

"Marketing efficiency decreases after approximately ₹1.2 crore in this scenario, suggesting diminishing returns."

"Competitor price reduction in Month 8 slows new-patient acquisition."

Generate 3–5 observations based on actual simulation results.

Do not fabricate insights disconnected from the data.

---

# 23. Recommended visual design

The application should look like a modern pharmaceutical strategy product.

Style:

Clean
Professional
Executive-friendly
Modern
Data-heavy but not cluttered

Use a light neutral background.

Use cards sparingly.

Use strong typography.

Avoid excessive gradients.

Use clear information hierarchy.

Use responsive layouts.

Charts should be interactive where possible.

---

# 24. Suggested UI layout

Sidebar:

Overview

Configure Launch

Simulation

Segments

Scenario Comparison

Sensitivity

Methodology

Main header:

GlucoNova Launch Simulator

Small subtitle:

AI-assisted pharmaceutical launch strategy simulation

Top-right:

Simulation status

Run Simulation button

Save Scenario button

---

# 25. Methodology page

Include a transparent explanation.

Sections:

What the simulator does

Synthetic patient generation

Synthetic physician generation

Adoption model

Marketing response

Competitor model

Financial model

Limitations

Explicitly state:

"This simulator is an educational proof of concept. The model coefficients and generated outcomes are illustrative and are not validated for real pharmaceutical forecasting, investment decisions, clinical decisions, or medical use."

---

# 26. Technology

Preferred stack:

Next.js

React

TypeScript

Tailwind CSS

Recharts

No backend is necessary for version 1 unless useful.

Run all simulations client-side.

If useful, create simulation logic in:

/lib/simulation.ts

Synthetic data generation in:

/lib/generatePopulation.ts

Financial calculations in:

/lib/financialModel.ts

Types in:

/types/simulation.ts

Keep business logic separated from UI components.

---

# 27. Core data structures

Create a LaunchConfig interface containing:

marketSize

physicianCount

simulationMonths

price

marketingBudget

consumerMarketingShare

physicianMarketingShare

digitalMarketingShare

insuranceCoverage

discountRate

salesReps

outreachIntensity

differentiation

convenienceAdvantage

adherenceAttractiveness

competitorStrength

competitorEvents

Create a MonthlyResult interface containing:

month

physicianAwareness

physicianAdoption

patientAwareness

newPatients

activePatients

marketShare

monthlyRevenue

cumulativeRevenue

monthlyCost

cumulativeCost

monthlyProfit

cumulativeProfit

marketingROI

Create ScenarioResult containing:

config

monthlyResults

summaryMetrics

segmentResults

physicianResults

---

# 28. Reproducibility

Use a fixed seed for all pseudo-random values.

Create an optional:

"Reseed Simulation"

button.

Changing the seed should create a different synthetic market.

Keeping the seed fixed should produce identical outcomes for identical configurations.

---

# 29. Performance

Do not simulate all 100,000 patients individually if it harms browser performance.

Generate approximately:

10,000 representative patients

Scale results to market size.

Generate:

500 physicians

The simulation should complete in under a few seconds on a normal laptop.

---

# 30. Default demo scenarios

Preconfigure three scenarios.

## Premium

Price:
₹2,100

Marketing:
₹60 lakh

Insurance coverage:
40%

Physician outreach:
High

Consumer marketing:
20%

## Balanced

Price:
₹1,600

Marketing:
₹85 lakh

Insurance coverage:
55%

Physician outreach:
Medium

Consumer marketing:
30%

## Penetration

Price:
₹1,150

Marketing:
₹1.2 crore

Insurance coverage:
65%

Physician outreach:
High

Consumer marketing:
40%

The user should be able to load these instantly.

---

# 31. Important simulation behavior

Ensure the model behaves directionally sensibly.

For example:

Increasing price should generally decrease patient adoption.

Increasing insurance coverage should generally increase adoption.

Increasing physician outreach should generally increase prescribing.

Increasing marketing should increase awareness but with diminishing returns.

Increasing competitor strength should reduce adoption.

Increasing differentiation should improve physician adoption.

Reducing price excessively may increase adoption but not necessarily maximize revenue.

Increasing marketing indefinitely should not produce infinite ROI.

Market share must remain between 0% and 100%.

Adoption must remain between 0% and 100%.

No output should contain NaN, Infinity, or impossible values.

---

# 32. Prototype success criteria

The finished prototype should allow a judge to perform this workflow:

1. Open the application.

2. Load the Balanced Launch scenario.

3. View launch assumptions.

4. Click Run Simulation.

5. Observe adoption evolve over 24 months.

6. See market share, revenue, physician adoption, patient adoption, ROI, and break-even.

7. Change drug price from ₹1,600 to ₹2,100.

8. Run another simulation.

9. Save both scenarios.

10. Compare them side-by-side.

11. Open sensitivity analysis.

12. Analyze how price changes simulated revenue and adoption.

13. View the AI Strategy Analyst's explanation of the trade-offs.

This full workflow should take less than five minutes and look impressive in a live college demonstration.

---

# 33. Most important requirement

Do not build this as just a CRUD dashboard.

The simulation must be the heart of the application.

Changing launch decisions must visibly change:

physician behavior

patient behavior

adoption

market share

revenue

profitability

and strategic insights.

The user should feel like they are experimenting with a small virtual pharmaceutical market.

Start by implementing a complete working MVP with realistic synthetic data and polished UI. Prioritize functionality and coherent simulation behavior over unnecessary features.