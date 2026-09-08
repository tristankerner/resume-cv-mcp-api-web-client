import { type FormEvent, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as contactsApi from "@/lib/api/contacts";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { CONTACT_RATING_OPTIONS } from "@/lib/config";
import { store } from "@/store/store";

export function CreateContactView({ companyId }: { companyId?: number }) {
  const [company, setCompany] = useState<number | null>(companyId ?? null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState("");
  const [description, setDescription] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = !!(firstName.trim() || lastName.trim() || email.trim());

  async function submit(force = false) {
    setBusy(true);
    setError(null);
    try {
      const created = await contactsApi.createContact({
        company_id: company,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        rating: rating ? Number(rating) : null,
        description: description.trim() || null,
        personal_note: personalNote.trim() || null,
        confirm_create_duplicate: force,
      });
      store.navigate("contact", { id: created.id });
    } catch (err) {
      const dup = asDuplicateConflict(err);
      if (dup) {
        setConflict(dup);
        return;
      }
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">New contact</h2>
      <Banner kind="error">{error}</Banner>
      {conflict && (
        <div className="mb-4">
          <DuplicateWarning
            conflict={conflict}
            busy={busy}
            onOpen={(id) => store.navigate("contact", { id })}
            onForce={() => submit(true)}
          />
        </div>
      )}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit(false);
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label>Company</Label>
          <CompanyPicker value={company} onChange={(id) => setCompany(id)} allowCreate allowNone />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contact-first">First name</Label>
            <Input id="contact-first" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-last">Last name</Label>
            <Input id="contact-last" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
          </div>
        </div>
        {!valid && (
          <p className="text-sm text-muted-foreground">
            At least one of first name, last name or email is required.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="contact-rating">Rating</Label>
          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger id="contact-rating" className="w-full">
              <SelectValue placeholder="— none —" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_RATING_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={String(r.value)}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-description">Description</Label>
          <Textarea
            id="contact-description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-note">Personal note</Label>
          <Textarea id="contact-note" value={personalNote} onChange={(e) => setPersonalNote(e.currentTarget.value)} />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || !valid}>
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={() => store.navigate("contacts")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
