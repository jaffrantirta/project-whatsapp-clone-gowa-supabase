import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// -----------------------------
// Supabase client
// -----------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// -----------------------------
// Verify HMAC signature
// -----------------------------
function verifyWebhookSignature(payload: string, signature: string, secret: string) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  const receivedSignature = signature.replace("sha256=", "").trim();

  console.log("expectedSignature", expectedSignature);
  console.log("receivedSignature", receivedSignature);

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(receivedSignature, "hex")
  );
}

// -----------------------------
// Helper: Get or Create Account
// -----------------------------
async function getOrCreateAccount(phoneNumber: string, accountName: string) {
/* eslint-disable-next-line prefer-const */
  let { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (!account) {
    const insertRes = await supabase
      .from("whatsapp_accounts")
      .insert({
        phone_number: phoneNumber,
        name: accountName,
      })
      .select()
      .single();

    if (insertRes.error) throw insertRes.error;
    account = insertRes.data;
  }

  return account;
}

// -----------------------------
// Helper: Get or Create Contact
// -----------------------------
async function getOrCreateContact(accountId: number, jid: string, name?: string, isGroup = false) {
  // For contacts table, we use chat_id as the primary key and store the full JID
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("account_id", accountId)
    .eq("jid", jid)
    .single();

  if (!contact) {
    const insertRes = await supabase
      .from("contacts")
      .insert({
        account_id: accountId,
        jid: jid,
        name: name || "Unknown",
        is_group: isGroup || jid.includes("@g.us"),
      })
      .select()
      .single();

    if (insertRes.error) {
      console.error("Error creating contact:", insertRes.error);
      throw insertRes.error;
    }
    return insertRes.data;
  }

  return contact;
}

// -----------------------------
// Helper: Handle Message Media
// -----------------------------
/* eslint-disable-next-line prefer-const */
async function handleMessageMedia(messageId: number, data: any) {
  const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
  
  for (const mediaType of mediaTypes) {
    if (data[mediaType]) {
      await supabase.from("message_media").insert({
        message_id: messageId,
        media_type: mediaType,
        mime_type: data[mediaType].mime_type,
        file_path: data[mediaType].media_path,
        caption: data[mediaType].caption || null,
      });
      break;
    }
  }
}

// -----------------------------
// Helper: Handle Message Location
// -----------------------------
/* eslint-disable-next-line prefer-const */
async function handleMessageLocation(messageId: number, location: any) {
  await supabase.from("message_locations").insert({
    message_id: messageId,
    latitude: location.degreesLatitude,
    longitude: location.degreesLongitude,
    name: location.name || null,
    address: location.address || null,
    jpeg_thumbnail: location.JPEGThumbnail || null,
  });
}

// -----------------------------
// Helper: Handle Message Contact
// -----------------------------
/* eslint-disable-next-line prefer-const */
async function handleMessageContact(messageId: number, contact: any) {
  // Store contact info as JSON in the text field or create a separate contacts table
  const contactInfo = {
    displayName: contact.displayName,
    vcard: contact.vcard,
  };
  
  // Update the message with contact information
  await supabase
    .from("messages")
    .update({ text: JSON.stringify(contactInfo) })
    .eq("id", messageId);
}

// -----------------------------
// Main Webhook Handler
// -----------------------------
export async function POST(req: NextRequest) {
  const payloadRaw = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET!;
  const whatsapp_account_number = process.env.WHATSAPP_ACCOUNT_NUMBER || "UNKNOWN";
  const whatsapp_account_name = process.env.WHATSAPP_ACCOUNT_NAME || "UNKNOWN";

  if (!verifyWebhookSignature(payloadRaw, signature, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log('verify webhook passed');

/* eslint-disable-next-line prefer-const */
  let data: any;
  try {
    console.log('data parsing');
    data = JSON.parse(payloadRaw);
  } catch (err) {
    console.error("Error parsing JSON:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    console.log('get or create account');
    const account = await getOrCreateAccount(whatsapp_account_number, whatsapp_account_name);
    console.log('got or created account');

    // -----------------------------
    // Handle Regular Messages
    // -----------------------------
    if (data.message && !data.event && !data.action) {

      // Determine if this is a group chat
      const isGroup = data.chat_id?.includes("@g.us") || data.from?.includes("@g.us");
      
      // Get or create contact/chat
      const contact = await getOrCreateContact(
        account.id,
        data.chat_id || data.from,
        data.pushname,
        isGroup
      );

      // Determine message type
      /* eslint-disable-next-line prefer-const */
      let messageType = "text";
      if (data.image) messageType = "image";
      else if (data.video) messageType = "video";
      else if (data.audio) messageType = "audio";
      else if (data.document) messageType = "document";
      else if (data.sticker) messageType = "sticker";
      else if (data.contact) messageType = "contact";
      else if (data.location) messageType = "location";

      // Insert message
      const { data: messageData, error: msgError } = await supabase
        .from("messages")
        .insert({
          account_id: account.id,
          chat_id: contact.id,
          sender_jid: data.from,
          message_id: data.message.id,
          type: messageType,
          text: data.message.text || null,
          quoted_message: data.message.quoted_message || null,
          replied_to_id: data.message.replied_id || null,
          forwarded: data.forwarded || false,
          view_once: data.view_once || false,
          created_at: data.timestamp,
        })
        .select()
        .single();

      if (msgError) {
        console.error("Insert message error:", msgError);
        throw msgError;
      }

      // Handle media attachments
      if (messageData && (data.image || data.video || data.audio || data.document || data.sticker)) {
        await handleMessageMedia(messageData.id, data);
      }

      // Handle location
      if (messageData && data.location) {
        await handleMessageLocation(messageData.id, data.location);
      }

      // Handle contact
      if (messageData && data.contact) {
        await handleMessageContact(messageData.id, data.contact);
      }

      // Handle reaction
      if (data.reaction) {
        // Find the message being reacted to
        const { data: targetMessage } = await supabase
          .from("messages")
          .select("id")
          .eq("message_id", data.reaction.id)
          .single();

        if (targetMessage) {
          await supabase.from("message_reactions").insert({
            message_id: targetMessage.id,
            sender_jid: data.from,
            reaction: data.reaction.message,
          });
        }
      }
    }

    // -----------------------------
    // Handle Message Acknowledgments
    // -----------------------------
    else if (data.event === "message.ack") {
      
      for (const msgId of data.payload.ids) {
        // Find the message in our database
        const { data: message } = await supabase
          .from("messages")
          .select("id")
          .eq("message_id", msgId)
          .single();

        if (message) {
          await supabase.from("message_receipts").insert({
            message_id: message.id,
            recipient_jid: data.payload.sender_id,
            receipt_type: data.payload.receipt_type,
            description: data.payload.receipt_type_description,
            created_at: data.timestamp,
          });
        }
      }
    }

    // -----------------------------
    // Handle Group Events
    // -----------------------------
    else if (data.event === "group.participants") {
      
      // Get or create the group contact
      const groupContact = await getOrCreateContact(
        account.id,
        data.payload.chat_id,
        undefined,
        true
      );

      // Handle different participant actions
      for (const jid of data.payload.jids) {
        switch (data.payload.type) {
          case "join":
            await supabase.from("group_participants").upsert({
              group_id: groupContact.id,
              participant_jid: jid,
              is_admin: false,
              joined_at: data.timestamp,
              left_at: null,
            }, {
              onConflict: "group_id,participant_jid"
            });
            break;

          case "leave":
            await supabase
              .from("group_participants")
              .update({ left_at: data.timestamp })
              .eq("group_id", groupContact.id)
              .eq("participant_jid", jid)
              .is("left_at", null);
            break;

          case "promote":
            await supabase
              .from("group_participants")
              .update({ is_admin: true })
              .eq("group_id", groupContact.id)
              .eq("participant_jid", jid);
            break;

          case "demote":
            await supabase
              .from("group_participants")
              .update({ is_admin: false })
              .eq("group_id", groupContact.id)
              .eq("participant_jid", jid);
            break;
        }
      }
    }

    // -----------------------------
    // Handle Message Actions
    // -----------------------------
    else if (data.action === "message_revoked") {
      
      // Find the message that was revoked
      const { data: message } = await supabase
        .from("messages")
        .select("id")
        .eq("message_id", data.revoked_message_id)
        .single();

      if (message) {
        await supabase.from("message_revokes").insert({
          message_id: message.id,
          revoked_by_jid: data.from,
          revoked_at: data.timestamp,
          revoked_for_me: data.revoked_from_me || false,
        });

        // Update the message to mark it as revoked
        await supabase
          .from("messages")
          .update({ text: "[Message was deleted]" })
          .eq("id", message.id);
      }
    }

    else if (data.action === "message_edited") {
      
      // Find the message that was edited
      const { data: message } = await supabase
        .from("messages")
        .select("id")
        .eq("message_id", data.message.id)
        .single();

      if (message) {
        // Record the edit
        await supabase.from("message_edits").insert({
          message_id: message.id,
          edited_text: data.edited_text,
          edited_at: data.timestamp,
        });

        // Update the original message with the edited text
        await supabase
          .from("messages")
          .update({ text: data.edited_text })
          .eq("id", message.id);
      }
    }

    // -----------------------------
    // Handle Unknown Events
    // -----------------------------
    else {
    }

    return NextResponse.json({ status: "ok" });

  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}