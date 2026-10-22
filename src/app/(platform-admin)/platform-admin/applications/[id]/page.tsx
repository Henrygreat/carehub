import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import { db } from "@/lib/db";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";
import { ApplicationReviewActions } from "@/components/platform-admin/application-review-actions";

export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ id: string }> };

export default async function ApplicationDetailPage({ params }: PageParams) {
  const { id } = await params;
  await resolvePlatformAdminContext();

  const application = await db.organisationApplication.findUnique({
    where: { id },
    select: {
      id: true,
      companyName: true,
      tradingName: true,
      companyRegistrationNo: true,
      registeredAddressLine1: true,
      registeredAddressLine2: true,
      registeredCity: true,
      registeredPostcode: true,
      primaryContactName: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
      careServiceTypes: true,
      cqcRegistrationNo: true,
      estimatedStaffCount: true,
      estimatedBranchCount: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      reviewedBy: {
        select: { id: true, name: true, email: true },
      },
      reviewNotes: true,
      rejectionReason: true,
      organisationId: true,
      organisation: {
        select: { id: true, name: true, slug: true, status: true },
      },
      privacyNoticeAccepted: true,
      termsAccepted: true,
      createdAt: true,
    },
  });

  if (!application) {
    notFound();
  }

  const canReview = ["SUBMITTED", "UNDER_REVIEW"].includes(application.status);

  return (
    <div className="space-y-6">
      <section>
        <Link
          href="/platform-admin/applications"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Back to applications
        </Link>
        <div className="mt-4 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-teal-100 text-teal-700">
              <Building2 size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {application.companyName}
              </h1>
              {application.tradingName && (
                <p className="text-slate-500">t/a {application.tradingName}</p>
              )}
            </div>
          </div>
          <StatusBadge status={application.status} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Company Details */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Company Details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">
                  Registered Name
                </dt>
                <dd className="mt-1 text-sm text-slate-900">{application.companyName}</dd>
              </div>
              {application.tradingName && (
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Trading Name
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">{application.tradingName}</dd>
                </div>
              )}
              {application.companyRegistrationNo && (
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Company Reg. No.
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {application.companyRegistrationNo}
                  </dd>
                </div>
              )}
              {application.cqcRegistrationNo && (
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    CQC Registration
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {application.cqcRegistrationNo}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Address */}
          {(application.registeredAddressLine1 || application.registeredCity) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-slate-400" />
                <h2 className="font-semibold text-slate-900">Registered Address</h2>
              </div>
              <address className="mt-3 text-sm not-italic text-slate-700">
                {application.registeredAddressLine1 && <div>{application.registeredAddressLine1}</div>}
                {application.registeredAddressLine2 && <div>{application.registeredAddressLine2}</div>}
                {application.registeredCity && <div>{application.registeredCity}</div>}
                {application.registeredPostcode && <div>{application.registeredPostcode}</div>}
              </address>
            </section>
          )}

          {/* Primary Contact */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <User size={18} className="text-slate-400" />
              <h2 className="font-semibold text-slate-900">Primary Contact</h2>
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-slate-900">
                {application.primaryContactName}
              </p>
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Mail size={14} />
                <a
                  href={`mailto:${application.primaryContactEmail}`}
                  className="hover:text-teal-700"
                >
                  {application.primaryContactEmail}
                </a>
              </p>
              {application.primaryContactPhone && (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={14} />
                  {application.primaryContactPhone}
                </p>
              )}
            </div>
          </section>

          {/* Care Services */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Care Services</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {application.careServiceTypes.map((service: string) => (
                <span
                  key={service}
                  className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700"
                >
                  {service}
                </span>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {application.estimatedStaffCount && (
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Estimated Staff
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    ~{application.estimatedStaffCount} employees
                  </dd>
                </div>
              )}
              {application.estimatedBranchCount && (
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Estimated Branches
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    ~{application.estimatedBranchCount} locations
                  </dd>
                </div>
              )}
            </div>
          </section>

          {/* Review Notes (if reviewed) */}
          {application.reviewedAt && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900">Review Details</h2>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Reviewed By
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {application.reviewedBy?.name ?? "Unknown"} on{" "}
                    {new Date(application.reviewedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                {application.reviewNotes && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">
                      Review Notes
                    </dt>
                    <dd className="mt-1 text-sm text-slate-700">
                      {application.reviewNotes}
                    </dd>
                  </div>
                )}
                {application.rejectionReason && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">
                      Rejection Reason
                    </dt>
                    <dd className="mt-1 text-sm text-rose-700">
                      {application.rejectionReason}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Provisioned Organisation (if approved) */}
          {application.organisation && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h2 className="font-semibold text-emerald-900">Organisation Provisioned</h2>
              </div>
              <p className="mt-2 text-sm text-emerald-700">
                This application has been approved and the organisation has been created.
              </p>
              <Link
                href={`/platform-admin/organisations/${application.organisation.id}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-900"
              >
                View organisation <ExternalLink size={14} />
              </Link>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Timeline</h2>
            <div className="mt-4 space-y-4">
              <TimelineItem
                label="Submitted"
                date={application.submittedAt}
                active={application.status === "SUBMITTED"}
              />
              {application.reviewedAt && (
                <TimelineItem
                  label={`${application.status === "REJECTED" ? "Rejected" : application.status === "APPROVED" ? "Approved" : "Reviewed"}`}
                  date={application.reviewedAt}
                  active={false}
                />
              )}
            </div>
          </section>

          {/* Consent */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Consent</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {application.privacyNoticeAccepted ? (
                  <CheckCircle2 size={14} className="text-emerald-600" />
                ) : (
                  <XCircle size={14} className="text-rose-500" />
                )}
                <span className="text-slate-600">Privacy notice accepted</span>
              </div>
              <div className="flex items-center gap-2">
                {application.termsAccepted ? (
                  <CheckCircle2 size={14} className="text-emerald-600" />
                ) : (
                  <XCircle size={14} className="text-rose-500" />
                )}
                <span className="text-slate-600">Terms of service accepted</span>
              </div>
            </div>
          </section>

          {/* Review Actions */}
          {canReview && (
            <ApplicationReviewActions
              applicationId={application.id}
              currentStatus={application.status}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    SUBMITTED: {
      bg: "bg-amber-100",
      text: "text-amber-800",
      icon: <Clock size={14} />,
    },
    UNDER_REVIEW: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      icon: <Clock size={14} />,
    },
    APPROVED: {
      bg: "bg-emerald-100",
      text: "text-emerald-800",
      icon: <CheckCircle2 size={14} />,
    },
    REJECTED: {
      bg: "bg-rose-100",
      text: "text-rose-800",
      icon: <XCircle size={14} />,
    },
  };

  const style = config[status] ?? config.SUBMITTED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${style.bg} ${style.text}`}
    >
      {style.icon}
      {status.replace("_", " ")}
    </span>
  );
}

function TimelineItem({
  label,
  date,
  active,
}: {
  label: string;
  date: Date | null;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`size-2.5 rounded-full ${
          active ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {date && (
          <p className="text-xs text-slate-500">
            {new Date(date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
