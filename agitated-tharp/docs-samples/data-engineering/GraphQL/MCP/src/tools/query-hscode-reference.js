/**
 * Tool: query_hscode_reference
 *
 * 查詢 HS Code 參考資料 (UNION_REF_HSCODE)。
 * 提供台灣經貿數據中使用的 HS Code 對照表，
 * 包含產業分類、HS Code 編碼、中文品名、計量單位等參考資訊。
 */

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_hscode_reference';

export const description =
  `查詢 HS Code 參考資料 (UNION_REF_HSCODE)。

用途：查詢台灣經貿數據中使用的 HS Code（國際商品統一分類代碼）對照表。
此表包含產業分類、HS Code 編碼、中文品名、計量單位等參考資訊。

可用欄位：
- Report_ID: 報告編號（用於識別不同報告的 HS Code 集合）
- Industry_ID: 產業編號（數值型，用於關聯其他產業相關表）
- Industry: 產業名稱（中文，如「電子零組件」「機械」「塑膠及其製品」）
- HS_Code_Group: HS Code 群組（通常為 2-4 碼的前綴分類）
- HS_Code: 完整 HS Code（6-11 碼的貨品分類代碼）
- HS_Code_ZH: HS Code 中文品名說明
- Unit_Name: 計量單位名稱（如「公斤」「公噸」「個」）
- Unit: 計量單位代碼

支援的篩選操作：
- 字串欄位: eq, contains, startsWith, endsWith, neq, isNull, in
- 數值欄位(Industry_ID): eq, gt, gte, lt, lte, neq, isNull, in
- 複合條件: and, or

常見使用場景：
1. 查詢特定產業的所有 HS Code: filter: { Industry: { contains: "電子" } }
2. 查詢特定 HS Code 的品名: filter: { HS_Code: { eq: "847130" } }
3. 依產業分組統計 HS Code 數量: groupBy: ["Industry"]
4. 模糊搜尋品名: filter: { HS_Code_ZH: { contains: "半導體" } }`;

export const parameters = z.object({
  first: z.number().optional().describe(
    '回傳筆數上限。預設 100，最大 5000。'
  ),
  after: z.string().optional().describe(
    '分頁游標。使用前次查詢回傳的 endCursor 值來取得下一頁。'
  ),
  filter: z.object({
    Report_ID: z.any().optional().describe('報告編號篩選（字串篩選）'),
    Industry_ID: z.any().optional().describe('產業編號篩選（數值篩選）例: { eq: 1 }'),
    Industry: z.any().optional().describe('產業名稱篩選（字串篩選）例: { contains: "電子" }'),
    HS_Code_Group: z.any().optional().describe('HS Code 群組篩選（字串篩選）'),
    HS_Code: z.any().optional().describe('HS Code 篩選（字串篩選）例: { eq: "847130" } 或 { startsWith: "85" }'),
    HS_Code_ZH: z.any().optional().describe('中文品名篩選（字串篩選）例: { contains: "半導體" }'),
    Unit_Name: z.any().optional().describe('計量單位名稱篩選'),
    Unit: z.any().optional().describe('計量單位代碼篩選'),
    and: z.any().optional().describe('AND 複合條件'),
    or: z.any().optional().describe('OR 複合條件'),
  }).optional().describe(
    '篩選條件。'
  ),
  orderBy: z.record(z.enum(['ASC', 'DESC'])).optional().describe(
    '排序條件。例: { "HS_Code": "ASC" }'
  ),
  fields: z.array(z.string()).optional().describe(
    '指定回傳欄位。預設所有欄位。'
  ),
  groupBy: z.array(z.string()).optional().describe(
    '分組欄位。例: ["Industry"] 依產業分組統計。'
  ),
  aggregations: z.array(z.object({
    field: z.string().describe('聚合欄位（數值欄位: Industry_ID）'),
    function: z.enum(['sum', 'avg', 'min', 'max', 'count']).describe('聚合函數'),
  })).optional().describe(
    '聚合操作。搭配 groupBy 使用。'
  ),
});

export async function handler(params) {
  try {
    const first = Math.min(params.first || config.defaultPageSize, config.maxPageSize);
    const { query, variables } = buildQuery('UNION_REF_HSCODE', {
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
        text: JSON.stringify({ error: 'HS Code reference query failed', details: err.message }),
      }],
      isError: true,
    };
  }
}
