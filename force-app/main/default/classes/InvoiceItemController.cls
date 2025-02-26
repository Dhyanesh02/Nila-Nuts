public with sharing class InvoiceItemController {
    @AuraEnabled
    public static String createInvoiceItems(String invoiceId, List<InvoiceItemWrapper> items) {
        try {
            List<Invoice_Item__c> invoiceItems = new List<Invoice_Item__c>();
            
            for (InvoiceItemWrapper item : items) {
                Invoice_Item__c invoiceItem = new Invoice_Item__c(
                    Invoice__c = invoiceId,
                    Product__c = item.productId,
                    Quantity__c = item.quantity,
                    Discount__c = item.discount,
                    Price__c = item.price,
                    
                );
                invoiceItems.add(invoiceItem);
            }
            
            if (!invoiceItems.isEmpty()) {
                insert invoiceItems;
                return 'Success';
            }
            return 'No items to create';
            
        } catch (Exception e) {
            throw new AuraHandledException('Error creating invoice items: ' + e.getMessage());
        }
    }
    
    public class InvoiceItemWrapper {
        @AuraEnabled public String productId;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public Decimal discount;
        @AuraEnabled public Decimal price;
    }
} 