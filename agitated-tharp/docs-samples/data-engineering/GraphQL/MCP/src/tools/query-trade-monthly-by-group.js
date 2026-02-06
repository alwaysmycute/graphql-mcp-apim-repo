/**
 * Tool: query_trade_monthly_by_group
 *
 * 查詢按產業群組與國家分組的月度貿易統計資料 (trade_monthly_by_group_country)。
 *
 * 此工具提供較高層次的產業別貿易統計，資料已按產業群組（而非單一 HS Code）
 * 預先彙總，適合進行產業層級的分析。
 *
 * 與 query_trade_monthly_by_code 的差異：
 * - query_trade_monthly_by_code: 細到個別 HS Code 層級，適合分析特定商品
 * - query_trade_monthly_by_group: 彙總到產業群組層級，適合分析整體產業趨勢
 *
 * 額外包含 AREA_ID 和 AREA_NM（地區資訊），可直接按地區分析，
 * 不需要額外關聯國家/地區參考表。
 */

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_monthly_by_group';

export const description =
  `查詢按產業群組（Industry Group）與國家分組的月度貿易統計資料。

用途：提供台灣按產業分類彙總的月度進出口貿易數據。
適合分析整體產業趨勢，包含地區歸屬資訊，可直接按洲別/經濟區域分析。
此表資料已按產業群組彙總，比個別 HS Code 查詢更高效。

與 query_trade_monthly_by_code 的選擇建議：
- 需要看特定商品（如某個 HS Code）的數據 → 用 query_trade_monthly_by_code
- 需要看整個產業（如「電子零組件」產業整體）的數據 → 用本工具
- 需要按地區（如「亞洲」「歐洲」）彙總分析 → 用本工具（已含地區欄位）

可用欄位：
- PERIOD_MONTH: 統計月份（DateTime 格式）
- YEAR: 年份（整數）
- MONTH: 月份（整數，1-12）
- TRADE_FLOW: 貿易流向（"1"=出口, "2"=進口）
- INDUSTRY_ID: 產業編號（整數，對應 HS Code 參考表的 Industry_ID）
- INDUSTRY: 產業名稱（中文，如「電子零組件」「機械」「資通與視聽產品」）
- HS_CODE_GROUP: HS Code 群組代碼（通常為 2-4 碼前綴）
- COUNTRY_ID: 國家代碼（ISO3 格式）
- COUNTRY_COMM_ZH: 國家中文名稱
- AREA_ID: 地區代碼
- AREA_NM: 地區名稱（如「亞洲」「歐洲」「北美洲」「中東」）
- TRADE_VALUE_USD_AMT: 貿易金額_美元
- TRADE_VALUE_TWD_AMT: 貿易金額_新台幣
- TRADE_WEIGHT: 貿易重量_公斤
- TRADE_QUANT: 貿易數量
- UNIT_PRICE_USD_PER_KG: 單位價格_美元/公斤
- ETL_DT: 資料更新日期

TRADE_FLOW 值說明：
- "1" = 出口（Export）：台灣出口到其他國家
- "2" = 進口（Import）：其他國家進口到台灣

常見使用場景：
1. 查詢電子零組件產業 2024 年出口趨勢:
   filter: { YEAR: { eq: 2024 }, TRADE_FLOW: { eq: "1" }, INDUSTRY: { contains: "電子" } }
2. 按地區統計出口總額:
   filter: { YEAR: { eq: 2024 }, TRADE_FLOW: { eq: "1" } }, groupBy: ["AREA_NM"]
3. 比較各產業出口表現:
   filter: { YEAR: { eq: 2024 }, TRADE_FLOW: { eq: "1" } }, groupBy: ["INDUSTRY"]
4. 查詢對亞洲地區的進口資料:
   filter: { AREA_NM: { eq: "亞洲" }, TRADE_FLOW: { eq: "2" } }
5. 按產業和地區交叉分析:
   groupBy: ["INDUSTRY", "AREA_NM"], filter: { YEAR: { eq: 2024 } }`;

export const parameters = z.object({
  first: z.number().optional().describe(
    '回傳筆數上限。預設 100，最大 5000。'
  ),
  after: z.string().optional().describe(
    '分頁游標。'
  ),
  filter: z.object({
    PERIOD_MONTH: z.any().optional().describe('統計月份篩選（日期篩選）'),
    YEAR: z.any().optional().describe('年份篩選（整數篩選）例: { eq: 2024 }'),
    MONTH: z.any().optional().describe('月份篩選（整數篩選 1-12）'),
    TRADE_FLOW: z.any().optional().describe('貿易流向篩選（"1"=出口, "2"=進口）'),
    INDUSTRY_ID: z.any().optional().describe('產業編號篩選（整數篩選）'),
    INDUSTRY: z.any().optional().describe('產業名稱篩選（字串篩選）例: { contains: "電子" }'),
    HS_CODE_GROUP: z.any().optional().describe('HS Code 群組篩選（字串篩選）'),
    COUNTRY_ID: z.any().optional().describe('國家代碼篩選（ISO3）例: { eq: "USA" }'),
    COUNTRY_COMM_ZH: z.any().optional().describe('國家中文名稱篩選'),
    AREA_ID: z.any().optional().describe('地區代碼篩選'),
    AREA_NM: z.any().optional().describe('地區名稱篩選 例: { eq: "亞洲" }'),
    TRADE_VALUE_USD_AMT: z.any().optional().describe('美元金額篩選'),
    TRADE_VALUE_TWD_AMT: z.any().optional().describe('新台幣金額篩選'),
    TRADE_WEIGHT: z.any().optional().describe('重量篩選（公斤）'),
    TRADE_QUANT: z.any().optional().describe('數量篩選'),
    UNIT_PRICE_USD_PER_KG: z.any().optional().describe('單位價格篩選'),
    ETL_DT: z.any().optional().describe('資料更新日期篩選'),
    and: z.any().optional().describe('AND 複合條件'),
    or: z.any().optional().describe('OR 複合條件'),
  }).optional().describe(
    '篩選條件。建議至少指定 YEAR 或 PERIOD_MONTH 範圍。'
  ),
  orderBy: z.record(z.enum(['ASC', 'DESC'])).optional().describe(
    '排序條件。例: { "TRADE_VALUE_USD_AMT": "DESC" }'
  ),
  fields: z.array(z.string()).optional().describe(
    '指定回傳欄位。預設所有欄位。'
  ),
  groupBy: z.array(z.string()).optional().describe(
    '分組欄位。例: ["INDUSTRY", "AREA_NM"] 按產業和地區分組。'
  ),
  aggregations: z.array(z.object({
    field: z.string().describe('聚合欄位（數值欄位: YEAR, MONTH, INDUSTRY_ID, TRADE_VALUE_USD_AMT, TRADE_VALUE_TWD_AMT, TRADE_WEIGHT, TRADE_QUANT, UNIT_PRICE_USD_PER_KG）'),
    function: z.enum(['sum', 'avg', 'min', 'max', 'count']).describe('聚合函數'),
  })).optional().describe(
    '聚合操作。'
  ),
});

export async function handler(params) {
  try {
    const first = Math.min(params.first || config.defaultPageSize, config.maxPageSize);
    const { query, variables } = buildQuery('trade_monthly_by_group_country', {
      ...params,
      first,
    });

    const result = await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query,
      variables,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'Trade monthly by group query failed', details: err.message }),
      }],
      isError: true,
    };
  }
}
