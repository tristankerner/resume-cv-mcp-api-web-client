import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Banner } from "@/components/common/Banner";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateUserDialog } from "@/features/admin/CreateUserDialog";
import { ResetMfaDialog } from "@/features/admin/ResetMfaDialog";
import { ResetPasswordDialog } from "@/features/admin/ResetPasswordDialog";
import { UnlockDialog } from "@/features/admin/UnlockDialog";
import * as adminApi from "@/lib/api/admin";
import type { AdminUser } from "@/lib/api/admin";
import { ApiError, errorMessage } from "@/lib/api/client";

type UserStatus = "active" | "disabled" | "locked" | "locked_permanently";

function userStatus(user: AdminUser): UserStatus {
  if (user.locked_permanently_at) return "locked_permanently";
  if (user.locked) return "locked";
  if (!user.active) return "disabled";
  return "active";
}

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Active",
  disabled: "Disabled",
  locked: "Locked",
  locked_permanently: "Locked permanently",
};

const STATUS_VARIANT: Record<UserStatus, "success" | "secondary" | "destructive"> = {
  active: "success",
  disabled: "secondary",
  locked: "destructive",
  locked_permanently: "destructive",
};

export function UsersView() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<AdminUser | null>(null);
  const [resetMfaTarget, setResetMfaTarget] = useState<AdminUser | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<AdminUser | null>(null);

  async function load() {
    setError(null);
    try {
      setUsers((await adminApi.listUsers()).data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <Banner kind="error">{error}</Banner>;
  if (users === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <PageHeader title="Users" actions={<Button onClick={() => setShowCreate(true)}>New user</Button>} />

      <Table className="table-reflow">
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>MFA</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const status = userStatus(user);
            return (
              <TableRow key={user.id}>
                <TableCell data-label="Username">{user.username}</TableCell>
                <TableCell data-label="Name">
                  {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell data-label="Email">{user.email || "—"}</TableCell>
                <TableCell data-label="Roles" className="whitespace-normal">
                  {user.roles.join(", ") || "none"}
                </TableCell>
                <TableCell data-label="Status">
                  <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                </TableCell>
                <TableCell data-label="MFA">
                  <Badge variant={user.mfa_enrolled ? "success" : "secondary"}>
                    {user.mfa_enrolled ? "Enrolled" : "None"}
                  </Badge>
                </TableCell>
                <TableCell data-label="">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${user.username}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setResetPasswordTarget(user)}>
                        Reset password
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => setResetMfaTarget(user)}>
                        Reset MFA
                      </DropdownMenuItem>
                      {/* `user.locked`, not `status === "locked"`: a
                          permanent lock reports its own status and is
                          precisely the one that never lapses on its own, so
                          gating on the temporary status left the only lock
                          an admin has to clear by hand with no way to
                          clear it. */}
                      {user.locked && (
                        <DropdownMenuItem onSelect={() => setUnlockTarget(user)}>Unlock</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {showCreate && (
        <CreateUserDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            toast.success("User created with three seeded example documents.");
            load();
          }}
        />
      )}
      {resetPasswordTarget && (
        <ResetPasswordDialog
          user={resetPasswordTarget}
          onClose={() => setResetPasswordTarget(null)}
          onReset={() => {
            setResetPasswordTarget(null);
            toast.success("Password reset.");
          }}
        />
      )}
      {resetMfaTarget && (
        <ResetMfaDialog
          user={resetMfaTarget}
          onClose={() => setResetMfaTarget(null)}
          onReset={() => {
            setResetMfaTarget(null);
            toast.success("MFA reset.");
            load();
          }}
        />
      )}
      {unlockTarget && (
        <UnlockDialog
          user={unlockTarget}
          onClose={() => setUnlockTarget(null)}
          onUnlocked={() => {
            setUnlockTarget(null);
            toast.success("Account unlocked.");
            load();
          }}
        />
      )}
    </div>
  );
}
