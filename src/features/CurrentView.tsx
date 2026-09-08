import { AccountView } from "@/features/account/AccountView";
import { OAuthClientsView } from "@/features/admin/OAuthClientsView";
import { UsersView } from "@/features/admin/UsersView";
import { ApiKeysView } from "@/features/api-keys/ApiKeysView";
import { ApplicationDetailView } from "@/features/applications/ApplicationDetailView";
import { ApplicationListView } from "@/features/applications/ApplicationListView";
import { CreateApplicationView } from "@/features/applications/CreateApplicationView";
import { CompanyDetailView } from "@/features/companies/CompanyDetailView";
import { CompanyListView } from "@/features/companies/CompanyListView";
import { CreateCompanyView } from "@/features/companies/CreateCompanyView";
import { ContactDetailView } from "@/features/contacts/ContactDetailView";
import { ContactListView } from "@/features/contacts/ContactListView";
import { CreateContactView } from "@/features/contacts/CreateContactView";
import { CreateDocumentView } from "@/features/documents/CreateDocumentView";
import { DocumentListView } from "@/features/documents/DocumentListView";
import { EditDocumentView } from "@/features/documents/EditDocumentView";
import { SecurityView } from "@/features/security/SecurityView";
import type { DocType } from "@/lib/config";
import { useStore } from "@/store/useStore";

export function CurrentView() {
  const { view, viewParams } = useStore();
  switch (view) {
    case "documents":
      return <DocumentListView />;
    case "create":
      return <CreateDocumentView />;
    case "edit":
      return (
        <EditDocumentView
          key={viewParams!.type + "/" + viewParams!.name}
          type={viewParams!.type as DocType}
          name={viewParams!.name!}
        />
      );
    case "applications":
      return <ApplicationListView />;
    case "application":
      return <ApplicationDetailView key={viewParams!.id} id={viewParams!.id!} />;
    case "application-create":
      return <CreateApplicationView />;
    case "companies":
      return <CompanyListView />;
    case "company":
      return <CompanyDetailView key={viewParams!.id} id={viewParams!.id!} />;
    case "company-create":
      return <CreateCompanyView />;
    case "contacts":
      return <ContactListView />;
    case "contact":
      return <ContactDetailView key={viewParams!.id} id={viewParams!.id!} />;
    case "contact-create":
      return <CreateContactView companyId={viewParams?.companyId} />;
    case "api-keys":
      return <ApiKeysView />;
    case "security":
      return <SecurityView />;
    case "account":
      return <AccountView />;
    case "admin-users":
      return <UsersView />;
    case "admin-oauth-clients":
      return <OAuthClientsView />;
    default:
      return null;
  }
}
