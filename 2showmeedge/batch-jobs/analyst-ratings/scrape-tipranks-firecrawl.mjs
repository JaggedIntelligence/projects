const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
//const TIPRANKS_COOKIE = process.env.TIPRANKS_COOKIE;

const TIPRANKS_COOKIE =tr-experiments-version=1.14; tipranks-experiments=%7b%22Experiments%22%3a%5b%7b%22Name%22%3a%22general_A%22%2c%22Variant%22%3a%22v4%22%2c%22SendAnalytics%22%3afalse%7d%2c%7b%22Name%22%3a%22general_B%22%2c%22Variant%22%3a%22v3%22%2c%22SendAnalytics%22%3afalse%7d%2c%7b%22Name%22%3a%22general_C%22%2c%22Variant%22%3a%22v2%22%2c%22SendAnalytics%22%3afalse%7d%5d%7d; tipranks-experiments-slim=general_A%3av4%7cgeneral_B%3av3%7cgeneral_C%3av2; _ga=GA1.1.1577909741.1769098505; _fbp=fb.1.1769098504907.733102912767745632; usprivacy=1YNY; _lc2_fpi=63104890847c--01kfk7stvrbt3zd5pwkrbadkj2; _lc2_fpi_meta=%7B%22w%22%3A1769098505080%7D; _scor_uid=77f5eb57126f4e309f1ee2abbf890236; _cc_id=3c01fd8480985f7d0bfd7b74185663d3; prism_90278194=6045902e-57b8-4732-8c2b-934a9f453b9d; _hjSessionUser_2550200=eyJpZCI6IjAwMTJjZTMwLWQwZWMtNTAwZi04ZTcxLTExZTkzMTkyYmU3YiIsImNyZWF0ZWQiOjE3NjkwOTg1MDUxNjEsImV4aXN0aW5nIjp0cnVlfQ==; token=883187867d62f109d8e062b2ac2552994e3486c7; loginType=login; g_state={"i_l":0,"i_ll":1769099072590,"i_b":"OSMY5XcUzJjljffGuXOHxrBlWE1J7ix88cP/Y3ZJ7p8","i_e":{"enable_itp_optimization":0}}; tr-plan-id=6; tr-plan-name=premium; tr-uid=D79460E9DA227AF533F157B06C659403; _tfpvi=OTJhNmJlNmQtMmZmNi00Nzc1LWI5MWYtZmIzMGYyNjdhYjRiIy05LTU%3D; user=srview9%40gmail.com%2cSubba+Reddy%2c; paymentProviders=%5b%7b%22Name%22%3a%22Stripe%22%2c%22Id%22%3a5%2c%22PaymentProvider%22%3a5%2c%22ProductPlanId%22%3a6%7d%5d; nextPaymentProvider=null; AMP_fe4beb374f=JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjJmMGE1ZDY3Mi1iMjVlLTQ4NDEtOWU1Mi1hYmFlNDAzM2Y4NWUlMjIlMkMlMjJ1c2VySWQlMjIlM0ElMjI4ZTFjZDUyYS03OGVhLTRkYmMtYmFmOC1kMmQyNDhiODI5NjclMjIlMkMlMjJzZXNzaW9uSWQlMjIlM0ExNzY5MTgwMDk0ODUwJTJDJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJsYXN0RXZlbnRUaW1lJTIyJTNBMTc2OTE4MDA5NDg1MiUyQyUyMmxhc3RFdmVudElkJTIyJTNBMyU3RA==; __gads=ID=988b5d7e9ca224c6:T=1769098503:RT=1773043971:S=ALNI_MZ413gaIXPphJB4VzdJwCzWQ-_qpw; __gpi=UID=0000132da46ebe3e:T=1769098503:RT=1773043971:S=ALNI_MZbQUWi_RgnCxYOt22QmIBmwvXU6A; __eoi=ID=0d22afcc601248e2:T=1769098503:RT=1773043971:S=AA-AfjZa44KMj6_PNiz81sRmLTNG; personal-message=; test_group_a=v4; test_group_b=v3; _pk_id.92.5890=a8f0caab7063a47e.1774461250.; _gcl_au=1.1.810931723.1776897232; FPAU=1.1.810931723.1776897232; _hjHasCachedUserAttributes=true; _ga_FFX3CZN1WY=deleted; chat_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOjEsInVzZXJfaWQiOiJENzk0NjBFOURBMjI3QUY1MzNGMTU3QjA2QzY1OTQwMyIsImVtYWlsIjoic3J2aWV3OUBnbWFpbC5jb20iLCJ0aWVyIjoicHJlbWl1bSIsImlhdCI6MTc4MDYwNTc2MCwiZXhwIjoxNzgwNjkyMTYwLCJwb3J0Zm9saW9zIjpbeyJpZCI6MTk2MDI4NSwibmFtZSI6Ik5ldyBQb3J0Zm9saW8gSmFuIDIwMjYifV19.iaUz-TqsoTxxPnfLn47xSqsVGewh9yNqjOmY__0rOLw; _gcl_gs=2.1.k1$i1780606671$u180625186; FPGCLAW=2.1.kCjwKCAjwxITRBhBYEiwA6mZm7WR05ZCfIx7YrNZZez8xB4c89fqZN36vbFgO2gqIN5ZVq_cxH2xwAhoCHX4QAvD_BwE%2CCjwKCAjwxITRBhBYEiwA6mZm7WR05ZCfIx7YrNZZez8xB4c89fqZN36vbFgO2gqIN5ZVq_cxH2xwAhoCHX4QAvD_BwE$i1780606673; FPGCLGS=2.1.k1$i1780606671$u180625186; _gcl_aw=GCL.1780606674.CjwKCAjwxITRBhBYEiwA6mZm7WR05ZCfIx7YrNZZez8xB4c89fqZN36vbFgO2gqIN5ZVq_cxH2xwAhoCHX4QAvD_BwE; _ga_M6BZF9W1EL=GS2.1.s1780606687$o1$g1$t1780606924$j60$l0$h0; cf_clearance=8Hor7lDB53ucNoD8irAA5XAZO.dtsWEHVT7xYznQL1I-1780606924-1.2.1.1-6zzOH6Lht6JbqQozxK3xPh7YxH0HmxSmLyE_pXwwkzYBdiNYJWxF5VJLsPREv_V56iLB5xPuyTFBgkmX0.UA3j6InNd8UJV_hu8rcZCUUzYH2CvBCHGwnhi.ymHFivZ60T879fnjwdCm1VKz5xWVqNFsorkvviCtD7n8KF8pAa1_ikfMlX6C..XLW8L8JboCwO6Kw2RM8LBiVjisNyHATavMi2f_qBwHXu7qaJIh8QQ1ySVaI16vPIRFe0iUTLbu5p83Yjgs6sqqS5sDFBdhGUsPGlUIXTuaP0RUtkNBMk817i5OJJ5Tkr6llQ0p7yc50j.L587ygJgyweLDamasxw; AMP_MKTG_fe4beb374f=JTdCJTIycmVmZXJyZXIlMjIlM0ElMjJodHRwcyUzQSUyRiUyRm1jcC50aXByYW5rcy5jb20lMkYlMjIlMkMlMjJyZWZlcnJpbmdfZG9tYWluJTIyJTNBJTIybWNwLnRpcHJhbmtzLmNvbSUyMiU3RA==; __cf_bm=dEb0YRYInpnGz9ekQEEjwoBScdzx2AvgqIBCmKQmdhM-1780611295.283559-1.0.1.1-rxHxy1Lmiu5gyBdtpaMCdCswPRK29JIVvwxtQN4WjLqucIYHBHE7_dHlBiPVv20i2RWXm6QC4k6p.F0L6_ROH3aBfX2owj6il5DKse.huEzHLVHjApb0_XvSqYqNZbOL; AMP_fe4beb374f=JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjJmMGE1ZDY3Mi1iMjVlLTQ4NDEtOWU1Mi1hYmFlNDAzM2Y4NWUlMjIlMkMlMjJ1c2VySWQlMjIlM0ElMjI4ZTFjZDUyYS03OGVhLTRkYmMtYmFmOC1kMmQyNDhiODI5NjclMjIlMkMlMjJzZXNzaW9uSWQlMjIlM0ExNzY5MTgwMDk0ODUwJTJDJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJsYXN0RXZlbnRUaW1lJTIyJTNBMTc2OTE4MDA5NDg1MiUyQyUyMmxhc3RFdmVudElkJTIyJTNBMyU3RA==; _hjSession_2550200=eyJpZCI6IjhkMmFkNjAwLWEwMzItNDdjMy05ZDYzLWVkZTMzNzMzYzBkYyIsImMiOjE3ODA2MTEyOTY0MTcsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _ga_FFX3CZN1WY=GS2.1.s1780611294$o98$g1$t1780611296$j58$l0$h466127598; _pk_ref.92.5890=%5B%22%22%2C%22%22%2C1780611298%2C%22https%3A%2F%2Fwww.google.com%2F%22%5D; _pk_ses.92.5890=1

const URL =
  process.env.TIPRANKS_URL ?? "https://www.tipranks.com/stocks/amd/forecast";

if (!FIRECRAWL_API_KEY) {
  throw new Error("Missing FIRECRAWL_API_KEY environment variable.");
}

const analystRatingsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ticker: { type: "string" },
    sourceUrl: { type: "string" },
    asOfText: { type: "string" },
    consensusRating: { type: "string" },
    averagePriceTarget: { type: "string" },
    highPriceTarget: { type: "string" },
    lowPriceTarget: { type: "string" },
    impliedUpside: { type: "string" },
    analystRatings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          analystName: { type: "string" },
          firm: { type: "string" },
          rating: { type: "string" },
          priceTarget: { type: "string" },
          priorPriceTarget: { type: "string" },
          action: { type: "string" },
          date: { type: "string" },
          upsideDownside: { type: "string" },
          successRate: { type: "string" },
          averageReturn: { type: "string" },
          rawText: { type: "string" },
        },
        required: [
          "analystName",
          "firm",
          "rating",
          "priceTarget",
          "priorPriceTarget",
          "action",
          "date",
          "upsideDownside",
          "successRate",
          "averageReturn",
          "rawText",
        ],
      },
    },
    extractionNotes: { type: "string" },
  },
  required: [
    "ticker",
    "sourceUrl",
    "asOfText",
    "consensusRating",
    "averagePriceTarget",
    "highPriceTarget",
    "lowPriceTarget",
    "impliedUpside",
    "analystRatings",
    "extractionNotes",
  ],
};

const headers = {};

if (TIPRANKS_COOKIE) {
  headers.Cookie = TIPRANKS_COOKIE;
}

const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: URL,
    formats: [
      "markdown",
      {
        type: "json",
        schema: analystRatingsSchema,
        prompt: [
          "Extract analyst target price and analyst ratings table data from the TipRanks forecast page.",
          "Focus on the analyst price target summary and the analyst ratings rows.",
          "Preserve formatted values exactly as shown, including currency symbols, percent signs, and dates.",
          "If the page shows a login wall, Cloudflare page, subscription wall, or missing table, return an empty analystRatings array and explain that in extractionNotes.",
        ].join(" "),
      },
    ],
    onlyMainContent: true,
    onlyCleanContent: true,
    waitFor: 5000,
    timeout: 120000,
    maxAge: 0,
    proxy: "enhanced",
    location: {
      country: "US",
      languages: ["en-US"],
    },
    headers,
    storeInCache: false,
  }),
});

const payload = await response.json().catch(async () => ({
  rawText: await response.text(),
}));

if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2));
  throw new Error(`Firecrawl scrape failed with HTTP ${response.status}.`);
}

const markdown = payload?.data?.markdown ?? "";
const extracted = payload?.data?.json ?? {};

const looksBlocked = /cloudflare|attention required|verify you are human|access denied|login|sign in/i.test(
  markdown,
);

console.log(
  JSON.stringify(
    {
      url: URL,
      looksBlocked,
      metadata: payload?.data?.metadata,
      analystRatings: extracted,
    },
    null,
    2,
  ),
);
