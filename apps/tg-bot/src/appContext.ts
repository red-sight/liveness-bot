import { Context, SessionFlavor } from "grammy";
import {
  Conversation,
  ConversationFn,
  type ConversationFlavor
} from "@grammyjs/conversations";
import { I18nFlavor } from "@grammyjs/i18n";

export type SessionData = {
  __language_code?: string; // i18n system variable
  user?: string;
};

export type AppConversation = Conversation<AppContext>;

export type AppConversationFn = ConversationFn<
  Context & SessionFlavor<SessionData>
>;

export type AppContext = Context &
  SessionFlavor<SessionData> &
  ConversationFlavor &
  I18nFlavor;

export function initial(): SessionData {
  return {};
}
