import { describe, expect, it } from "vitest"
import { getMatchScore } from "@/lib/promptDesignUtils"

describe("getMatchScore fuzzy matching algorithm", () => {
  it("correctly matches CuratorHistoryList.tsx via camel abbreviation when query is chl", () => {
    const curatorHistoryListScore = getMatchScore("src/renderer/src/features/curator/components/CuratorHistoryList.tsx", "chl")
    // Random accidental match in path like 'src/helper/layout/index.tsx' which has c, h, l sequentially in directory path
    const randomPathScore = getMatchScore("src/helper/layout/index.tsx", "chl")

    expect(curatorHistoryListScore).toBeGreaterThan(randomPathScore)
    // Verify it matches using the camel abbreviation logic (starts with/includes Caps, score is 2500+)
    expect(curatorHistoryListScore).toBeGreaterThanOrEqual(2500)
  })

  it("prefers matching filename subsequence over directory matching", () => {
    // filename: CuratorHistoryList.tsx, matches camel abbreviation "chl"
    const score1 = getMatchScore("src/renderer/src/features/curator/components/CuratorHistoryList.tsx", "chl")
    // filename: list.tsx, match "chl" is on path "curator/helper/list.tsx" (path matches only)
    const score2 = getMatchScore("src/renderer/src/features/curator/helper/list.tsx", "chl")

    expect(score1).toBeGreaterThan(score2)
  })

  it("gives high score for camels/abbreviations", () => {
    const score = getMatchScore("src/renderer/src/features/curator/components/CuratorHistoryList.tsx", "chl")
    expect(score).toBeGreaterThanOrEqual(2500)
  })

  it("calculates subsequence span correctly for compact filenames", () => {
    const compactScore = getMatchScore("src/components/MyChlFile.tsx", "chl") // 'chl' matches 'Chl' directly (span 3)
    const sparseScore = getMatchScore("src/components/C-Something-H-Else-L.tsx", "chl") // matches across filename (long span)
    expect(compactScore).toBeGreaterThan(sparseScore)
  })
})
