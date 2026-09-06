import { AccountView } from "@/features/account/AccountView";
import { OAuthClientsView } from "@/features/admin/OAuthClientsView";
import { UsersView } from "@/features/admin/UsersView";
import { ApiKeysView } from "@/features/api-keys/ApiKeysView";
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
