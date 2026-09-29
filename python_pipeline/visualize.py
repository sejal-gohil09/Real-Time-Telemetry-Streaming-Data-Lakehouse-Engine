"""
TelemetryHub — Energy Data Visualizations
Generates charts from real UK carbon intensity data (National Grid ESO API)
and simulated smart meter consumption data.

Usage:
    python3 python_pipeline/visualize.py

Outputs:
    python_pipeline/charts/01_carbon_intensity_trend.png
    python_pipeline/charts/02_daily_consumption_profile.png
    python_pipeline/charts/03_nation_comparison.png
    python_pipeline/charts/04_tariff_breakdown.png
    python_pipeline/charts/05_carbon_vs_consumption.png
    python_pipeline/charts/06_weekly_daily_totals.png
"""

import json
import os
import random
from datetime import datetime, timedelta

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np

# ── Config ────────────────────────────────────────────────────────────────────
random.seed(42)
CHART_DIR = os.path.join(os.path.dirname(__file__), 'charts')
os.makedirs(CHART_DIR, exist_ok=True)

DARK_BG = '#0f172a'
DARK_CARD = '#1e293b'
TEXT_COLOR = '#e2e8f0'
GRID_COLOR = '#334155'
COLORS = {
    'cyan': '#22d3ee',
    'blue': '#3b82f6',
    'amber': '#f59e0b',
    'red': '#ef4444',
    'green': '#10b981',
    'purple': '#8b5cf6',
    'pink': '#ec4899',
}

plt.rcParams.update({
    'figure.facecolor': DARK_BG,
    'axes.facecolor': DARK_CARD,
    'axes.edgecolor': GRID_COLOR,
    'axes.labelcolor': TEXT_COLOR,
    'text.color': TEXT_COLOR,
    'xtick.color': TEXT_COLOR,
    'ytick.color': TEXT_COLOR,
    'grid.color': GRID_COLOR,
    'grid.alpha': 0.3,
    'font.size': 10,
    'font.family': 'sans-serif',
})


def load_carbon_intensity():
    """Load real carbon intensity data fetched from the National Grid ESO API."""
    with open('/tmp/carbon_intensity_raw.json') as f:
        data = json.load(f)
    times = []
    actuals = []
    forecasts = []
    indices = []
    for rec in data['data']:
        dt = datetime.fromisoformat(rec['from'].replace('Z', '+00:00'))
        times.append(dt)
        actuals.append(rec['intensity'].get('actual', rec['intensity'].get('forecast')))
        forecasts.append(rec['intensity'].get('forecast'))
        indices.append(rec['intensity'].get('index', 'low'))
    return times, actuals, forecasts, indices


def generate_consumption_data():
    """Generate smart meter consumption data matching the database pattern."""
    daily_pattern = [
        0.18, 0.15, 0.13, 0.12, 0.11, 0.10, 0.10, 0.12,
        0.15, 0.22, 0.35, 0.52, 0.68, 0.75, 0.72, 0.55,
        0.42, 0.35, 0.30, 0.28, 0.26, 0.25, 0.24, 0.23,
        0.22, 0.21, 0.22, 0.24, 0.27, 0.32, 0.42, 0.58,
        0.75, 0.82, 0.85, 0.80, 0.72, 0.60, 0.48, 0.38,
        0.30, 0.25, 0.22, 0.20, 0.18, 0.17, 0.16, 0.15,
    ]
    peak_periods = set(list(range(14, 18)) + list(range(34, 40)))

    hourly_kwh = [0.0] * 24
    hourly_co2 = [0.0] * 24
    daily_kwh = [0.0] * 7
    daily_cost = [0.0] * 7
    daily_co2 = [0.0] * 7
    nation_kwh = {'England': 0, 'Scotland': 0, 'Wales': 0}
    nation_co2 = {'England': 0, 'Scotland': 0, 'Wales': 0}
    tariff_kwh = {'PEAK': 0, 'OFF_PEAK': 0, 'STANDARD': 0}
    tariff_cost = {'PEAK': 0, 'OFF_PEAK': 0, 'STANDARD': 0}

    times_ci, actuals_ci, _, _ = load_carbon_intensity()
    ci_by_time = {}
    for t, a in zip(times_ci, actuals_ci):
        ci_by_time[t.replace(minute=0, second=0)] = a
        ci_by_time[t.replace(minute=30, second=0)] = a

    for i in range(200):
        base_factor = random.uniform(0.6, 1.8)
        weekend_factor = random.uniform(0.9, 1.3)
        nation = 'England' if i < 140 else 'Scotland' if i < 170 else 'Wales'

        for day in range(7):
            date = datetime(2025, 1, 1) + timedelta(days=day)
            dow = date.weekday()
            is_weekend = dow >= 5

            for period in range(48):
                hour = period // 2
                kwh = daily_pattern[period] * base_factor
                if is_weekend:
                    kwh *= weekend_factor
                kwh *= random.uniform(0.85, 1.15)

                is_peak = period in peak_periods
                ci_time = date + timedelta(hours=hour, minutes=(period % 2) * 30)
                ci = ci_by_time.get(ci_time.replace(minute=0 if ci_time.minute < 30 else 30, second=0), 50)

                co2 = kwh * ci / 1000

                if is_peak:
                    cost = kwh * 0.3594
                    tariff_kwh['PEAK'] += kwh
                    tariff_cost['PEAK'] += cost
                elif hour < 7:
                    cost = kwh * 0.1392
                    tariff_kwh['OFF_PEAK'] += kwh
                    tariff_cost['OFF_PEAK'] += cost
                else:
                    cost = kwh * 0.2735
                    tariff_kwh['STANDARD'] += kwh
                    tariff_cost['STANDARD'] += cost

                hourly_kwh[hour] += kwh
                hourly_co2[hour] += co2
                daily_kwh[day] += kwh
                daily_cost[day] += cost
                daily_co2[day] += co2
                nation_kwh[nation] += kwh
                nation_co2[nation] += co2

    return {
        'hourly_kwh': hourly_kwh,
        'hourly_co2': hourly_co2,
        'daily_kwh': daily_kwh,
        'daily_cost': daily_cost,
        'daily_co2': daily_co2,
        'nation_kwh': nation_kwh,
        'nation_co2': nation_co2,
        'tariff_kwh': tariff_kwh,
        'tariff_cost': tariff_cost,
    }


# ── Chart 1: Carbon Intensity Trend ──────────────────────────────────────────
def chart_carbon_intensity_trend(times, actuals, indices):
    fig, ax = plt.subplots(figsize=(12, 5), dpi=150)

    colors = []
    for idx in indices:
        if idx == 'very low':
            colors.append(COLORS['green'])
        elif idx == 'low':
            colors.append('#84cc16')
        elif idx == 'moderate':
            colors.append(COLORS['amber'])
        elif idx == 'high':
            colors.append(COLORS['red'])
        else:
            colors.append('#dc2626')

    ax.fill_between(times, actuals, alpha=0.15, color=COLORS['amber'])
    ax.plot(times, actuals, color=COLORS['amber'], linewidth=1.5, label='Actual gCO2/kWh')
    ax.set_title('UK Carbon Intensity — National Grid ESO API', fontsize=14, fontweight='bold', color=TEXT_COLOR, pad=15)
    ax.set_ylabel('gCO2/kWh', fontsize=11)
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    ax.xaxis.set_major_locator(mdates.DayLocator())
    ax.legend(loc='upper right', facecolor=DARK_CARD, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR)
    ax.grid(True, alpha=0.2)
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, '01_carbon_intensity_trend.png'), facecolor=DARK_BG)
    plt.close()
    print('  [OK] 01_carbon_intensity_trend.png')


# ── Chart 2: Daily Consumption Profile ───────────────────────────────────────
def chart_daily_profile(data):
    fig, ax1 = plt.subplots(figsize=(12, 5), dpi=150)
    hours = range(24)

    ax1.bar(hours, data['hourly_kwh'], color=COLORS['cyan'], alpha=0.7, label='kWh')
    ax1.set_xlabel('Hour of Day', fontsize=11)
    ax1.set_ylabel('Total kWh', fontsize=11, color=COLORS['cyan'])
    ax1.set_title('Daily Consumption Profile — All 200 Customers', fontsize=14, fontweight='bold', color=TEXT_COLOR, pad=15)
    ax1.set_xticks(range(0, 24, 2))

    ax2 = ax1.twinx()
    ax2.plot(hours, data['hourly_co2'], color=COLORS['red'], linewidth=2, marker='o', markersize=3, label='kg CO2')
    ax2.set_ylabel('kg CO2', fontsize=11, color=COLORS['red'])
    ax2.tick_params(axis='y', labelcolor=COLORS['red'])

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', facecolor=DARK_CARD, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR)
    ax1.grid(True, alpha=0.2)
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, '02_daily_consumption_profile.png'), facecolor=DARK_BG)
    plt.close()
    print('  [OK] 02_daily_consumption_profile.png')


# ── Chart 3: Nation Comparison ────────────────────────────────────────────────
def chart_nation_comparison(data):
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), dpi=150)

    nations = list(data['nation_kwh'].keys())
    kwh_vals = [data['nation_kwh'][n] for n in nations]
    co2_vals = [data['nation_co2'][n] for n in nations]
    nation_colors = [COLORS['blue'], COLORS['cyan'], COLORS['green']]

    axes[0].bar(nations, kwh_vals, color=nation_colors, alpha=0.8)
    axes[0].set_title('Total kWh by Nation', fontsize=12, fontweight='bold', color=TEXT_COLOR)
    axes[0].set_ylabel('kWh', fontsize=11)

    axes[1].bar(nations, co2_vals, color=nation_colors, alpha=0.8)
    axes[1].set_title('Total kg CO2 by Nation', fontsize=12, fontweight='bold', color=TEXT_COLOR)
    axes[1].set_ylabel('kg CO2', fontsize=11)

    for ax in axes:
        ax.grid(True, alpha=0.2, axis='y')

    plt.suptitle('Energy Consumption by Nation — England vs Scotland vs Wales',
                 fontsize=14, fontweight='bold', color=TEXT_COLOR, y=1.02)
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, '03_nation_comparison.png'), facecolor=DARK_BG, bbox_inches='tight')
    plt.close()
    print('  [OK] 03_nation_comparison.png')


# ── Chart 4: Tariff Breakdown ─────────────────────────────────────────────────
def chart_tariff_breakdown(data):
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), dpi=150)

    bands = list(data['tariff_kwh'].keys())
    kwh_vals = [data['tariff_kwh'][b] for b in bands]
    cost_vals = [data['tariff_cost'][b] for b in bands]
    band_colors = [COLORS['red'], COLORS['green'], COLORS['amber']]

    axes[0].pie(kwh_vals, labels=[b.replace('_', ' ') for b in bands], colors=band_colors,
                autopct='%1.1f%%', textprops={'color': TEXT_COLOR, 'fontsize': 10},
                wedgeprops={'edgecolor': DARK_BG, 'linewidth': 2})
    axes[0].set_title('kWh Distribution by Tariff', fontsize=12, fontweight='bold', color=TEXT_COLOR)

    axes[1].bar([b.replace('_', ' ') for b in bands], cost_vals, color=band_colors, alpha=0.8)
    axes[1].set_title('Cost by Tariff Band', fontsize=12, fontweight='bold', color=TEXT_COLOR)
    axes[1].set_ylabel('GBP', fontsize=11)
    axes[1].grid(True, alpha=0.2, axis='y')

    plt.suptitle('Settlement Breakdown by Tariff Band',
                 fontsize=14, fontweight='bold', color=TEXT_COLOR, y=1.02)
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, '04_tariff_breakdown.png'), facecolor=DARK_BG, bbox_inches='tight')
    plt.close()
    print('  [OK] 04_tariff_breakdown.png')


# ── Chart 5: Carbon vs Consumption ────────────────────────────────────────────
def chart_carbon_vs_consumption(times, actuals, data):
    fig, ax1 = plt.subplots(figsize=(12, 5), dpi=150)

    # Aggregate hourly consumption to match carbon intensity timeline
    hourly_avg = []
    for h in range(24):
        hourly_avg.append(data['hourly_kwh'][h] / 7)  # average per day

    # Create a 7-day timeline for consumption
    cons_times = [datetime(2025, 1, 1) + timedelta(hours=h) for h in range(24)]
    cons_values = hourly_avg

    ax1.bar(cons_times, cons_values, color=COLORS['cyan'], alpha=0.5, label='Avg kWh per hour')
    ax1.set_ylabel('kWh', fontsize=11, color=COLORS['cyan'])
    ax1.tick_params(axis='y', labelcolor=COLORS['cyan'])
    ax1.set_xlabel('Hour of Day', fontsize=11)
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))

    ax2 = ax1.twinx()
    # Average carbon intensity by hour
    ci_by_hour = {}
    for t, a in zip(times, actuals):
        h = t.hour
        if h not in ci_by_hour:
            ci_by_hour[h] = []
        ci_by_hour[h].append(a)
    ci_hours = sorted(ci_by_hour.keys())
    ci_avg = [np.mean(ci_by_hour[h]) for h in ci_hours]
    ci_times = [datetime(2025, 1, 1) + timedelta(hours=h) for h in ci_hours]

    ax2.plot(ci_times, ci_avg, color=COLORS['amber'], linewidth=2.5, marker='o', markersize=4, label='Avg gCO2/kWh')
    ax2.set_ylabel('gCO2/kWh', fontsize=11, color=COLORS['amber'])
    ax2.tick_params(axis='y', labelcolor=COLORS['amber'])

    ax1.set_title('Consumption vs Carbon Intensity — Hourly Average',
                  fontsize=14, fontweight='bold', color=TEXT_COLOR, pad=15)

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left',
               facecolor=DARK_CARD, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR)
    ax1.grid(True, alpha=0.2)
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, '05_carbon_vs_consumption.png'), facecolor=DARK_BG)
    plt.close()
    print('  [OK] 05_carbon_vs_consumption.png')


# ── Chart 6: Weekly Daily Totals ──────────────────────────────────────────────
def chart_weekly_totals(data):
    fig, ax = plt.subplots(figsize=(12, 5), dpi=150)
    days = ['Wed\nJan 1', 'Thu\nJan 2', 'Fri\nJan 3', 'Sat\nJan 4', 'Sun\nJan 5', 'Mon\nJan 6', 'Tue\nJan 7']

    x = np.arange(len(days))
    width = 0.35

    ax.bar(x - width/2, data['daily_kwh'], width, color=COLORS['cyan'], alpha=0.8, label='kWh')
    ax.bar(x + width/2, [c * 10 for c in data['daily_cost']], width, color=COLORS['green'], alpha=0.8, label='Cost x10 (GBP)')

    ax.set_title('Weekly Consumption and Cost Summary', fontsize=14, fontweight='bold', color=TEXT_COLOR, pad=15)
    ax.set_ylabel('Value', fontsize=11)
    ax.set_xticks(x)
    ax.set_xticklabels(days)
    ax.legend(facecolor=DARK_CARD, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR)
    ax.grid(True, alpha=0.2, axis='y')
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, '06_weekly_daily_totals.png'), facecolor=DARK_BG)
    plt.close()
    print('  [OK] 06_weekly_daily_totals.png')


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print('TelemetryHub — Generating Energy Data Visualizations')
    print('=' * 55)

    print('\n1. Loading real carbon intensity data from National Grid ESO API...')
    times, actuals, forecasts, indices = load_carbon_intensity()
    print(f'   Loaded {len(times)} half-hourly records')

    print('\n2. Generating consumption data for 200 customers...')
    data = generate_consumption_data()
    total_kwh = sum(data['daily_kwh'])
    total_co2 = sum(data['daily_co2'])
    total_cost = sum(data['daily_cost'])
    print(f'   Total: {total_kwh:.0f} kWh, £{total_cost:.0f}, {total_co2:.0f} kg CO2')

    print('\n3. Generating charts...')
    chart_carbon_intensity_trend(times, actuals, indices)
    chart_daily_profile(data)
    chart_nation_comparison(data)
    chart_tariff_breakdown(data)
    chart_carbon_vs_consumption(times, actuals, data)
    chart_weekly_totals(data)

    print(f'\nAll charts saved to: {CHART_DIR}')
    print('Done!')


if __name__ == '__main__':
    main()
