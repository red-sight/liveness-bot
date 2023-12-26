import { Bot, CommandContext, InlineKeyboard, session } from "grammy";
import { config } from "@lib/config";
import { prisma } from "@lib/db";
import { I18n } from "@grammyjs/i18n";
import {
  AppContext,
  AppConversation,
  SessionData,
  initial
} from "./appContext";
import { RedisAdapter } from "@grammyjs/storage-redis";
import IORedis from "ioredis";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation
} from "@grammyjs/conversations";
import { DB } from "@lib/db/dist/context";

const bot = new Bot<AppContext>(config.tgBotToken);

const i18n = new I18n<AppContext>({
  defaultLocale: "en",
  directory: "locales"
});

const redisInstance = new IORedis("redis://localhost:6379/0");

bot.use(
  session({
    storage: new RedisAdapter<SessionData>({
      instance: redisInstance,
      ttl: 10
    }),
    initial
  }),
  conversations(),
  i18n
);

async function requestAccessConversation(
  conversation: AppConversation,
  ctx: AppContext
) {
  await ctx.reply(
    ctx.t("access-unauthorized", {
      fullname: getFullName(ctx, true)
    })
  );
  let newCtx = await conversation.waitFor("message:text");
  await ctx.reply(
    ctx.t("access-confirm-request", {
      fullname: getFullName(ctx, true)
    }),
    {
      reply_to_message_id: newCtx.msg.message_id,
      reply_markup: new InlineKeyboard().text(
        "✅ " + ctx.t("confirm"),
        "CONFIRM_ACCESS_REQUEST"
      )
    }
  );
}
bot.use(createConversation(requestAccessConversation));

bot.callbackQuery("CONFIRM_ACCESS_REQUEST", async (ctx) => {
  if (!ctx.update.callback_query.message?.reply_to_message?.text) {
    return await ctx.answerCallbackQuery({
      text: ctx.t("access-request-not-valid")
    });
  }

  const tg_id = ctx.update.callback_query.from.id.toString();
  const user = await prisma.user.findUnique({
    where: { tg_id }
  });

  const textCode = user
    ? user.role === "NONE"
      ? "access-request-already-registered"
      : "access-request-already-resolved"
    : "access-request-confirmed";

  if (!user)
    await prisma.user.create({
      data: {
        tg_id,
        access_request:
          ctx.update.callback_query.message?.reply_to_message?.text
      }
    });

  return await ctx.answerCallbackQuery({
    text: ctx.t(textCode)
  });
});

bot.command("start", async (ctx) => {
  if (ctx.update.message?.from) {
    const user = await prisma.user.findFirst({
      where: { tg_id: ctx.update.message.from.id.toString() }
    });
    if (!user)
      return await ctx.reply(
        ctx.t("start-unauthorized", {
          fullname: getFullName(ctx, true)
        })
      );
  }
  ctx.reply("Welcome! Up and running.");
});

bot.command("access", async (ctx) => {
  if (ctx.update.message?.from) {
    const user = await prisma.user.findFirst({
      where: { tg_id: ctx.update.message.from.id.toString() }
    });

    if (!user) return await ctx.conversation.enter("requestAccessConversation");

    const textCode =
      user.role === "NONE"
        ? "access-request-already-registered"
        : "access-request-already-resolved";

    return await ctx.reply(ctx.t(textCode));
  }
});

// bot.on("message", async (ctx) => {
//   console.dir(ctx.update, { depth: null });
//   ctx.reply("Got another message!");
// });

bot.start();

function getFullName(
  ctx: CommandContext<AppContext> | AppContext,
  withComma: boolean = false
): string {
  let name = "";

  if (ctx.update?.message?.from.first_name)
    name = ctx.update?.message?.from.first_name;
  else if (ctx.update?.message?.from.last_name)
    name = ` ${ctx.update?.message?.from.last_name}`;
  else {
    name = ctx.update?.message?.from.username || "";
  }

  return withComma ? `, ${name}` : name;
}
