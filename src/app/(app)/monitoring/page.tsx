"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Clock, MapPin, User, AlertTriangle, CheckCircle, XCircle, Play, RefreshCw } from "lucide-react";

type Visit = {
  id: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "MISSED" | "CANCELLED";
  visitType: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    addressLine1: string | null;
    postcode: string | null;
  };
  staffProfile: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function getStatusColor(status: Visit["status"]) {
  switch (status) {
    case "SCHEDULED":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-green-100 text-green-800";
    case "COMPLETED":
      return "bg-gray-100 text-gray-800";
    case "MISSED":
      return "bg-red-100 text-red-800";
    case "CANCELLED":
      return "bg-gray-100 text-gray-500";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status: Visit["status"]) {
  switch (status) {
    case "SCHEDULED":
      return <Clock className="h-4 w-4" />;
    case "IN_PROGRESS":
      return <Play className="h-4 w-4" />;
    case "COMPLETED":
      return <CheckCircle className="h-4 w-4" />;
    case "MISSED":
      return <XCircle className="h-4 w-4" />;
    case "CANCELLED":
      return <XCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function isOverdue(visit: Visit) {
  if (visit.status !== "SCHEDULED") return false;
  const now = new Date();
  const scheduledStart = new Date(visit.scheduledStart);
  // Consider a visit overdue if it should have started more than 15 minutes ago
  const overdueThreshold = new Date(scheduledStart.getTime() + 15 * 60 * 1000);
  return now > overdueThreshold;
}

function isRunningLate(visit: Visit) {
  if (visit.status !== "IN_PROGRESS" || !visit.actualStart) return false;
  const now = new Date();
  const scheduledEnd = new Date(visit.scheduledEnd);
  // Running late if past scheduled end
  return now > scheduledEnd;
}

function VisitCard({ visit }: { visit: Visit }) {
  const overdue = isOverdue(visit);
  const runningLate = isRunningLate(visit);
  const clientName = visit.client.preferredName
    ? `${visit.client.preferredName} (${visit.client.firstName})`
    : visit.client.firstName;

  return (
    <Link
      href={`/visits/${visit.id}`}
      className={`block border rounded-lg p-4 hover:shadow-md transition-shadow ${
        overdue ? "border-red-300 bg-red-50" : runningLate ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(visit.status)}`}>
              {getStatusIcon(visit.status)}
              {visit.status.replace("_", " ")}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            )}
            {runningLate && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                <AlertTriangle className="h-3 w-3" />
                Running Late
              </span>
            )}
          </div>

          <h3 className="font-medium text-gray-900 truncate">
            {clientName} {visit.client.lastName}
          </h3>

          {visit.client.addressLine1 && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{visit.client.addressLine1}, {visit.client.postcode}</span>
            </p>
          )}

          {visit.staffProfile && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <User className="h-3 w-3 flex-shrink-0" />
              {visit.staffProfile.firstName} {visit.staffProfile.lastName}
            </p>
          )}

          {!visit.staffProfile && (
            <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              Unassigned
            </p>
          )}
        </div>

        <div className="text-right text-sm">
          <div className="text-gray-500">Scheduled</div>
          <div className="font-medium">
            {formatTime(visit.scheduledStart)} - {formatTime(visit.scheduledEnd)}
          </div>
          {visit.actualStart && (
            <>
              <div className="text-gray-500 mt-2">Started</div>
              <div className="font-medium text-green-600">{formatDateTime(visit.actualStart)}</div>
            </>
          )}
        </div>
      </div>

      {visit.visitType && (
        <div className="mt-2 text-xs text-gray-500">
          {visit.visitType}
        </div>
      )}
    </Link>
  );
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchVisits = async () => {
    try {
      setError(null);
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(`/api/v1/visits?date=${today}`);
      if (!response.ok) {
        throw new Error("Failed to fetch visits");
      }
      const data = await response.json();
      setVisits(data.data || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError("Failed to load visits");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
    // Refresh every 30 seconds
    const interval = setInterval(fetchVisits, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check if user has access to this page
  const allowedRoles = ["ORG_ADMIN", "MANAGER", "COORDINATOR"];
  if (user && !allowedRoles.includes(user.role)) {
    router.push("/dashboard");
    return null;
  }

  const inProgressVisits = visits.filter((v) => v.status === "IN_PROGRESS");
  const scheduledVisits = visits.filter((v) => v.status === "SCHEDULED");
  const overdueVisits = scheduledVisits.filter(isOverdue);
  const completedVisits = visits.filter((v) => v.status === "COMPLETED");
  const missedVisits = visits.filter((v) => v.status === "MISSED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Visit Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time view of today&apos;s care visits
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={() => {
              setLoading(true);
              fetchVisits();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-semibold text-blue-600">{scheduledVisits.length}</div>
          <div className="text-sm text-gray-500">Scheduled</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-semibold text-green-600">{inProgressVisits.length}</div>
          <div className="text-sm text-gray-500">In Progress</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-semibold text-gray-600">{completedVisits.length}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </div>
        <div className={`border rounded-lg p-4 ${overdueVisits.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <div className={`text-2xl font-semibold ${overdueVisits.length > 0 ? "text-red-600" : "text-gray-400"}`}>
            {overdueVisits.length}
          </div>
          <div className="text-sm text-gray-500">Overdue</div>
        </div>
        <div className={`border rounded-lg p-4 ${missedVisits.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <div className={`text-2xl font-semibold ${missedVisits.length > 0 ? "text-red-600" : "text-gray-400"}`}>
            {missedVisits.length}
          </div>
          <div className="text-sm text-gray-500">Missed</div>
        </div>
      </div>

      {/* Alerts Section */}
      {(overdueVisits.length > 0 || missedVisits.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-medium text-red-800 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5" />
            Attention Required
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {overdueVisits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
            {missedVisits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </div>
        </div>
      )}

      {/* In Progress Section */}
      {inProgressVisits.length > 0 && (
        <div>
          <h2 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Play className="h-5 w-5 text-green-600" />
            In Progress ({inProgressVisits.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {inProgressVisits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Section */}
      {scheduledVisits.filter((v) => !isOverdue(v)).length > 0 && (
        <div>
          <h2 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Upcoming ({scheduledVisits.filter((v) => !isOverdue(v)).length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {scheduledVisits
              .filter((v) => !isOverdue(v))
              .map((visit) => (
                <VisitCard key={visit.id} visit={visit} />
              ))}
          </div>
        </div>
      )}

      {/* Completed Section */}
      {completedVisits.length > 0 && (
        <div>
          <h2 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-gray-600" />
            Completed ({completedVisits.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {completedVisits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </div>
        </div>
      )}

      {loading && visits.length === 0 && (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-500 mt-2">Loading visits...</p>
        </div>
      )}

      {!loading && visits.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <Clock className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="text-lg font-medium text-gray-900 mt-4">No visits scheduled for today</h3>
          <p className="text-gray-500 mt-1">Check back later or view all visits.</p>
          <Link
            href="/visits"
            className="inline-block mt-4 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
          >
            View All Visits
          </Link>
        </div>
      )}
    </div>
  );
}
