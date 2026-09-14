export const EAUC_ORIGIN = "https://eauc.setadiran.ir";

/**
 * Session bootstrap MUST go through welcome.action. Cookies minted by
 * subscriberDispatch.action are accepted by the list endpoint but rejected
 * with HTTP 500 by every detail endpoint.
 */
export const EAUC_WELCOME_URL = `${EAUC_ORIGIN}/eauc/welcome.action?gateway=setad`;
export const EAUC_REFERER = EAUC_WELCOME_URL;

export const LIST_URL = `${EAUC_ORIGIN}/eauc/mainEstate-Load.action`;
export const AUCTION_DETAIL_URL = `${EAUC_ORIGIN}/eauc/auctionDetailsViewAction-loadFormPart.action?mainAction_conversation=0`;
export const LOT_DETAIL_URL = `${EAUC_ORIGIN}/eauc/auctionPartyViewDetails-formPart.action?mainAction_conversation=0`;
export const LOT_ITEMS_URL = `${EAUC_ORIGIN}/eauc/auctionPartyViewDetails-grid.action`;

export const BACK_ACTION_NAME = "welcome-home-formPart";

export const EAUC_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** jqGrid rowNum on the منقول board. Drives the mirrored page numbering. */
export const SETADIRAN_ROWS_PER_PAGE = 30;

/** The whole category fits in one response; 5000 is headroom over ~980. */
export const LIST_PAGE_SIZE = 5000;

/** Caption preceding the deposit input on a lot detail page. */
export const DEPOSIT_CAPTION = "مبلغ ریالی ودیعه";
