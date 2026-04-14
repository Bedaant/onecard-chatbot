$base = "http://localhost:3009/api/chat"
$headers = @{ "Content-Type" = "application/json" }
$script:pass = 0
$script:fail = 0

function Chat($msg, $state) {
  $body = @{ message = $msg; sessionState = $state } | ConvertTo-Json -Compress
  try {
    $r = Invoke-RestMethod -Uri $base -Method POST -Headers $headers -Body $body -TimeoutSec 10
    Start-Sleep -Milliseconds 300
    return $r
  } catch { return $null }
}

function Check($label, $actual, $expected, $notExpected) {
  if ($null -eq $actual) {
    Write-Host "  FAIL  $label (null - rate limited or timeout)" -ForegroundColor Red
    $script:fail++
    return
  }
  $ok = $true
  $issues = @()
  foreach ($e in $expected) {
    if ($actual -notmatch $e) { $ok = $false; $issues += "MISSING: $e" }
  }
  foreach ($n in $notExpected) {
    if ($actual -match $n) { $ok = $false; $issues += "SHOULD NOT: $n" }
  }
  if ($ok) {
    Write-Host "  PASS  $label" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "  FAIL  $label" -ForegroundColor Red
    foreach ($i in $issues) { Write-Host "        $i" -ForegroundColor Yellow }
    $short = if ($actual.Length -gt 100) { $actual.Substring(0,100) } else { $actual }
    Write-Host "        Got: $short" -ForegroundColor DarkGray
    $script:fail++
  }
}

$e = @{ currentFlow = $null; collectedSlots = @{}; nextSlot = $null; frustrationScore = 0 }

Write-Host ""
Write-Host "=== FLOW TEST SUITE ===" -ForegroundColor Cyan

# 1. card_block
Write-Host ""
Write-Host "[1] card_block" -ForegroundColor White
$r = Chat "card block karo" $e
Check "trigger" $r.response @("lost|stolen|suspicious") @()
Check "flow=card_block" $r.flow_name @("card_block") @()
$s = @{ currentFlow = "card_block"; collectedSlots = @{}; nextSlot = "block_reason"; frustrationScore = 0 }
$r2 = Chat "Lost" $s
Check "complete" $r2.response @("blocked") @()
Check "flow_complete" ([string]$r2.flow_complete) @("True") @()

# 2. mid-flow interruptions
Write-Host ""
Write-Host "[2] mid-flow interruptions" -ForegroundColor White
$s = @{ currentFlow = "card_block"; collectedSlots = @{}; nextSlot = "block_reason"; frustrationScore = 0 }
$r = Chat "repayment kaise karu" $s
Check "repayment answered" $r.response @("pay|tarike|Back") @()
Check "flow preserved" $r.flow_name @("card_block") @()
$r2 = Chat "emi kya hota hai" $s
Check "EMI answered" $r2.response @("EMI|instalment|Back") @()
Check "flow preserved" $r2.flow_name @("card_block") @()
$r3 = Chat "interest rate kya hai" $s
Check "interest answered" $r3.response @("3.75|interest|Back") @()
Check "flow preserved" $r3.flow_name @("card_block") @()
$r4 = Chat "reward points kitne hain" $s
Check "rewards answered" $r4.response @("2.847|2,847|points|Back") @()
Check "flow preserved" $r4.flow_name @("card_block") @()

# 3. card_unblock
Write-Host ""
Write-Host "[3] card_unblock" -ForegroundColor White
$r = Chat "card unblock karo" $e
Check "completes immediately" $r.response @("unblocked") @()

# 4. card_replacement
Write-Host ""
Write-Host "[4] card_replacement" -ForegroundColor White
$r = Chat "replacement card chahiye" $e
Check "trigger" $r.response @("reason|replacement") @()
$s = @{ currentFlow = "card_replacement"; collectedSlots = @{}; nextSlot = "reason"; frustrationScore = 0 }
$r2 = Chat "Damaged" $s
Check "complete" $r2.response @("Replacement|7-10") @()
Check "flow_complete" ([string]$r2.flow_complete) @("True") @()

# 5. account_closure
Write-Host ""
Write-Host "[5] account_closure" -ForegroundColor White
$r = Chat "account close karna hai" $e
Check "shows prereqs" $r.response @("Outstanding|EMI|reward") @()
$s = @{ currentFlow = "account_closure"; collectedSlots = @{}; nextSlot = "confirm"; frustrationScore = 0 }
$r2 = Chat "yes please close" $s
Check "rejects bad confirm" $r2.response @("CLOSE MY ACCOUNT") @("submitted")
$r3 = Chat "CLOSE MY ACCOUNT" $s
Check "accepts correct confirm" $r3.response @("CLO-|submitted") @()
Check "flow_complete" ([string]$r3.flow_complete) @("True") @()

# 6. dispute_filing
Write-Host ""
Write-Host "[6] dispute_filing" -ForegroundColor White
$r = Chat "dispute file karna hai" $e
Check "trigger" $r.response @("transaction|merchant|dispute") @()
$s = @{ currentFlow = "dispute_filing"; collectedSlots = @{}; nextSlot = "transaction"; frustrationScore = 0 }
$r2 = Chat "Swiggy 450 Apr 12" $s
Check "asks reason" $r2.response @("reason") @()
$s2 = @{ currentFlow = "dispute_filing"; collectedSlots = @{ transaction = "Swiggy 450" }; nextSlot = "reason"; frustrationScore = 0 }
$r3 = Chat "Wrong amount" $s2
Check "complete" $r3.response @("DIS-|30 days") @()
Check "flow_complete" ([string]$r3.flow_complete) @("True") @()

# 7. emi_conversion
Write-Host ""
Write-Host "[7] emi_conversion" -ForegroundColor White
$r = Chat "Flipkart 15999 ko emi convert karna hai" $e
Check "trigger" $r.response @("transaction|merchant|amount") @()
$s = @{ currentFlow = "emi_conversion"; collectedSlots = @{}; nextSlot = "transaction"; frustrationScore = 0 }
$r2 = Chat "Flipkart 15999" $s
Check "asks tenure" $r2.response @("tenure|month") @()
$s2 = @{ currentFlow = "emi_conversion"; collectedSlots = @{ transaction = "Flipkart 15999" }; nextSlot = "tenure"; frustrationScore = 0 }
$r3 = Chat "6 months" $s2
Check "complete" $r3.response @("EMI|processing fee") @()
Check "flow_complete" ([string]$r3.flow_complete) @("True") @()

# 8. emi_foreclosure
Write-Host ""
Write-Host "[8] emi_foreclosure" -ForegroundColor White
$r = Chat "mujhe apna EMI foreclose karna hai" $e
Check "trigger" $r.response @("foreclose|EMI|Amazon") @()
Check "flow=emi_foreclosure" $r.flow_name @("emi_foreclosure") @()
$s = @{ currentFlow = "emi_foreclosure"; collectedSlots = @{}; nextSlot = "emi_select"; frustrationScore = 0 }
$r2 = Chat "Amazon 3750 8 remaining" $s
Check "complete" $r2.response @("foreclosure|principal|fee") @()
Check "flow_complete" ([string]$r2.flow_complete) @("True") @()

# 9. limit_increase
Write-Host ""
Write-Host "[9] limit_increase" -ForegroundColor White
$r = Chat "credit limit increase chahiye" $e
Check "trigger" $r.response @("limit|current") @()
Check "flow=limit_increase" $r.flow_name @("limit_increase") @()
$s = @{ currentFlow = "limit_increase"; collectedSlots = @{}; nextSlot = "amount"; frustrationScore = 0 }
$r2 = Chat "2 lakh" $s
Check "complete" $r2.response @("LIM-|working days") @()
Check "flow_complete" ([string]$r2.flow_complete) @("True") @()

# 10. fraud_report
Write-Host ""
Write-Host "[10] fraud_report" -ForegroundColor White
$r = Chat "mera card hack ho gaya" $e
Check "trigger" $r.response @("transaction|merchant|fraud") @()
Check "flow=fraud_report" $r.flow_name @("fraud_report") @()
$s = @{ currentFlow = "fraud_report"; collectedSlots = @{}; nextSlot = "txn_details"; frustrationScore = 0 }
$r2 = Chat "Amazon 12000 Apr 10" $s
Check "complete" $r2.response @("FRD-|provisional|30 days") @()
Check "flow_complete" ([string]$r2.flow_complete) @("True") @()

# 11-13. 0-slot flows
Write-Host ""
Write-Host "[11-13] 0-slot flows" -ForegroundColor White
$r = Chat "bill pay karna hai" $e
Check "bill_payment" $r.response @("56,500|outstanding") @()
Check "deep_link" $r.deep_link @("Pay Now") @()
$r2 = Chat "reward points redeem karna hai" $e
Check "reward_redemption" $r2.response @("2,847|points") @()
$r3 = Chat "statement download karna hai" $e
Check "statement_download" $r3.response @("statement|Apr 3") @()

# 14. autopay_setup
Write-Host ""
Write-Host "[14] autopay_setup" -ForegroundColor White
$r = Chat "autopay setup karna hai" $e
Check "trigger" $r.response @("autopay|Full|Minimum") @()
$s = @{ currentFlow = "autopay_setup"; collectedSlots = @{}; nextSlot = "autopay_type"; frustrationScore = 0 }
$r2 = Chat "Full outstanding" $s
Check "complete" $r2.response @("AutoPay|billing") @()
Check "flow_complete" ([string]$r2.flow_complete) @("True") @()
$r3 = Chat "random garbage" $s
Check "rejects invalid type" $r3.response @("Full outstanding|Minimum|Fixed") @()

# 15. address_change
Write-Host ""
Write-Host "[15] address_change" -ForegroundColor White
$r = Chat "address change karna hai" $e
Check "trigger" $r.response @("address|PIN") @()
Check "flow=address_change" $r.flow_name @("address_change") @()
$s = @{ currentFlow = "address_change"; collectedSlots = @{}; nextSlot = "new_address"; frustrationScore = 0 }
$r2 = Chat "short" $s
Check "rejects short address" $r2.response @("PIN|complete|house") @()
$r3 = Chat "Flat 4B Sunshine Apartments MG Road Bengaluru Karnataka 560001" $s
Check "accepts valid address" $r3.response @("updated|working days") @()
Check "flow_complete" ([string]$r3.flow_complete) @("True") @()

# 16. pin_change
Write-Host ""
Write-Host "[16] pin_change" -ForegroundColor White
$r = Chat "PIN change karna hai" $e
Check "complete immediately" $r.response @("PIN|SMS|link") @()

# 17. privacy_settings
Write-Host ""
Write-Host "[17] privacy_settings" -ForegroundColor White
$r = Chat "privacy settings update karo" $e
Check "trigger" $r.response @("update|Marketing|Transaction|preference") @()
Check "flow=privacy_settings" $r.flow_name @("privacy_settings") @()
$s = @{ currentFlow = "privacy_settings"; collectedSlots = @{}; nextSlot = "preference_type"; frustrationScore = 0 }
$r2 = Chat "Marketing notifications" $s
Check "complete" $r2.response @("Marketing notifications|updated") @()
Check "flow_complete" ([string]$r2.flow_complete) @("True") @()

# 18. support_escalation
Write-Host ""
Write-Host "[18] support_escalation" -ForegroundColor White
$r = Chat "escalate karo mera issue" $e
Check "trigger" $r.response @("issue|category|Card|EMI") @()
Check "flow=support_escalation" $r.flow_name @("support_escalation") @()
$s = @{ currentFlow = "support_escalation"; collectedSlots = @{}; nextSlot = "issue_category"; frustrationScore = 0 }
$r2 = Chat "Payment dispute" $s
Check "complete" $r2.response @("TKT-|2 hours|agent") @()
Check "flow_complete" ([string]$r2.flow_complete) @("True") @()

# 19. FAQ vs Flow
Write-Host ""
Write-Host "[19] FAQ vs Flow" -ForegroundColor White
$r = Chat "emi kya hota hai" $e
Check "no flow on EMI concept Q" ([string]$r.flow_name) @("") @("emi_conversion|emi_foreclosure")
$r2 = Chat "repayment kaise karte hain" $e
Check "no flow on repayment Q" ([string]$r2.flow_name) @("") @("bill_payment")
$r3 = Chat "block karne se kya hota hai" $e
Check "no flow on block info Q" ([string]$r3.flow_name) @("") @("card_block")
$r4 = Chat "interest se kaise bachu" $e
Check "no flow on interest avoidance Q" ([string]$r4.flow_name) @("") @("card_block")

# 20. cancel mid-flow
Write-Host ""
Write-Host "[20] cancel mid-flow" -ForegroundColor White
$s = @{ currentFlow = "card_block"; collectedSlots = @{}; nextSlot = "block_reason"; frustrationScore = 0 }
$r = Chat "cancel" $s
Check "flow_cancel=true" ([string]$r.flow_cancel) @("True") @()
Check "flow cleared" ([string]$r.flow_name) @("") @("card_block")

# 21. T1 static MITC
Write-Host ""
Write-Host "[21] T1 static MITC" -ForegroundColor White
$r = Chat "interest rate kya hai" $e
Check "T1_STATIC tier" $r.tier @("T1_STATIC") @()
Check "contains 3.75" $r.response @("3.75") @()
$r2 = Chat "forex markup kitna hai" $e
Check "T1 forex" $r2.tier @("T1_STATIC") @()
$r3 = Chat "emi foreclosure fee kya hai" $e
Check "T1 foreclosure info" $r3.tier @("T1_STATIC") @()
$r4 = Chat "emi foreclose karna hai" $e
Check "foreclose action bypasses T1" $r4.tier @("T1_STATIC") @("T1_STATIC")

# Summary
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  PASSED: $($script:pass)" -ForegroundColor Green
Write-Host "  FAILED: $($script:fail)" -ForegroundColor Red
Write-Host "  TOTAL:  $($script:pass + $script:fail)" -ForegroundColor White
Write-Host "==================================" -ForegroundColor Cyan
