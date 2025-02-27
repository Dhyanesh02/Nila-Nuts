trigger InvoiceTargetTrigger on Invoice__c (after update) {
    Set<Id> paidInvoiceIds = new Set<Id>();

    // Step 1: Collect Invoices where Status changed to "Paid"
    for (Invoice__c inv : Trigger.new) {
        Invoice__c oldInv = Trigger.oldMap.get(inv.Id);
        if (inv.Invoice_Status__c == 'Paid' && oldInv.Invoice_Status__c != 'Paid') {
            paidInvoiceIds.add(inv.Id);
        }
    }

    if (!paidInvoiceIds.isEmpty()) {
        // Call handler class to process the updates
        InvoiceTargetController.updateTargetLineItems(paidInvoiceIds);
    }
}