"""
Dashboard endpoints: site summary, activities chart.
"""
from dataclasses import asdict, dataclass
from typing import List, Optional

from flask import Blueprint, jsonify

from core import token_required, role_required

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dataclass
class DashboardSummary:
    siteId: Optional[str]
    plansCount: int
    validatedPlansCount: int
    activitiesThisMonth: int
    totalCost: float


@dataclass
class ActivitiesChart:
    labels: List[str]
    data: List[int]


@bp.get("/site/summary")
@token_required
@role_required("site", "corporate")
def site_summary():
    """Returns site dashboard metrics."""
    summary = DashboardSummary(
        siteId="SITE-01",
        plansCount=10,
        validatedPlansCount=7,
        activitiesThisMonth=3,
        totalCost=12345.67,
    )
    return jsonify(asdict(summary))


@bp.get("/site/activities-chart")
@token_required
@role_required("site", "corporate")
def site_activities_chart():
    """Returns activities chart data for last 6 months."""
    chart = ActivitiesChart(
        labels=["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        data=[2, 4, 1, 3, 5, 0],
    )
    return jsonify(asdict(chart))
