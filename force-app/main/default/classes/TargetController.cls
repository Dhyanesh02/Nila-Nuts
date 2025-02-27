public with sharing class TargetController {
    @AuraEnabled(cacheable=true)
    public static List<User> getSalesReps() {
        try {
            return [SELECT Id, Name 
                    FROM User 
                    WHERE IsActive = true 
                    WITH SECURITY_ENFORCED
                    ORDER BY Name];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching sales reps: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getTargetPeriods() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        
        try {
            Schema.DescribeFieldResult fieldResult = Target__c.Target_Period__c.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            
            for(Schema.PicklistEntry entry : ple) {
                options.add(new Map<String, String>{
                    'label' => entry.getLabel(),
                    'value' => entry.getValue()
                });
            }
            return options;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching target periods: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<String> getProductFamilies() {
        List<String> families = new List<String>();
        Schema.DescribeFieldResult fieldResult = Product__c.Product_Category__c.getDescribe();
        List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
        for(Schema.PicklistEntry entry : ple) {
            families.add(entry.getLabel());
        }
        return families;
    }

    @AuraEnabled
    public static List<Product__c> getProductsByFamily(String family) {
        return [SELECT Id, Name, Product_Category__c, 
        Product_Description__c, Price__c, Product_Image__c 
        FROM Product__c 
        WHERE Product_Category__c = :family 
        AND Active__c = true
        WITH SECURITY_ENFORCED];
    }

    @AuraEnabled
    public static void createTarget(Map<String, Object> targetData) {
        try {
            // Implement your target creation logic here
            // This will depend on your specific data model
        } catch(Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String createTargetWithLineItems(String targetData) {
        try {
            // Parse the target data
            Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(targetData);
            
            // Create Target record
            Target__c newTarget = new Target__c(
                Name = (String)data.get('targetName'),
                OwnerId = (String)data.get('salesRepId'),
                Target_Period__c = (String)data.get('targetPeriod'),
                Status__c = 'Pending'
            );
            
            insert newTarget;

            // Create Target Line Items
            List<Target_Line_Items__c> lineItems = new List<Target_Line_Items__c>();
            List<Object> items = (List<Object>)data.get('lineItems');
            
            for(Object item : items) {
                Map<String, Object> lineItem = (Map<String, Object>)item;
                lineItems.add(new Target_Line_Items__c(
                    Target__c = newTarget.Id,
                    Product__c = (String)lineItem.get('productId'),
                    Target_Quantity__c = (Decimal)lineItem.get('targetQuantity'),
                    Target_Amount__c = Decimal.valueOf((String)lineItem.get('targetAmount')),
                    Status__c = 'Pending'
                ));
            }
            
            insert lineItems;
            
            return newTarget.Id;
        } catch(Exception e) {
            throw new AuraHandledException('Error creating target: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static TargetSummaryWrapper getTargetVsActual(String period, String salesRepId) {
        try {
            // Get Target record with roll-up summaries
            Target__c target = [
                SELECT Id,
                       Total_Sales_Amount__c,
                       Total_Sales_Quantity__c,
                       Total_Target_Amount__c,
                       Total_Target_Quantity__c,
                       (SELECT Id, 
                               Name,
                               Product__c, 
                               Product__r.Name, 
                               Target_Quantity__c, 
                               Target_Amount__c,
                               Total_Sales_Quantity__c,
                               Total_Sales_Amount__c,
                               Achievement_Percentage__c
                        FROM Target_line_items__r)
                FROM Target__c
                WHERE Target_Period__c = :period
                AND OwnerId = :salesRepId
                LIMIT 1
            ];

            if (target == null) {
                return new TargetSummaryWrapper();
            }

            // Create line item comparisons
            List<TargetVsActualWrapper> lineItems = new List<TargetVsActualWrapper>();
            
            for(Target_line_items__c tli : target.Target_line_items__r) {
                lineItems.add(new TargetVsActualWrapper(
                    tli.Product__c,
                    tli.Product__r.Name,
                    tli.Target_Quantity__c,
                    tli.Target_Amount__c,
                    tli.Total_Sales_Quantity__c,
                    tli.Total_Sales_Amount__c,
                    tli.Achievement_Percentage__c
                ));
            }

            // Create and return summary wrapper
            return new TargetSummaryWrapper(target, lineItems);

        } catch(Exception e) {
            throw new AuraHandledException('Error getting target vs actual data: ' + e.getMessage());
        }
    }

    // Wrapper class for individual line items
    public class TargetVsActualWrapper {
        @AuraEnabled public String productId;
        @AuraEnabled public String productName;
        @AuraEnabled public Decimal targetQty;
        @AuraEnabled public Decimal targetAmount;
        @AuraEnabled public Decimal actualQty;
        @AuraEnabled public Decimal actualAmount;
        @AuraEnabled public Decimal achievement;

        public TargetVsActualWrapper(String productId, String productName, 
                                    Decimal targetQty, Decimal targetAmount,
                                    Decimal actualQty, Decimal actualAmount,
                                    Decimal achievement) {
            this.productId = productId;
            this.productName = productName;
            this.targetQty = targetQty != null ? targetQty : 0;
            this.targetAmount = targetAmount != null ? targetAmount : 0;
            this.actualQty = actualQty != null ? actualQty : 0;
            this.actualAmount = actualAmount != null ? actualAmount : 0;
            this.achievement = achievement != null ? achievement : 0;
        }
    }

    // Wrapper class for overall target summary
    public class TargetSummaryWrapper {
        @AuraEnabled public Decimal totalTargetQuantity;
        @AuraEnabled public Decimal totalTargetAmount;
        @AuraEnabled public Decimal totalSalesQuantity;
        @AuraEnabled public Decimal totalSalesAmount;
        @AuraEnabled public List<TargetVsActualWrapper> lineItems;

        public TargetSummaryWrapper() {
            this.totalTargetQuantity = 0;
            this.totalTargetAmount = 0;
            this.totalSalesQuantity = 0;
            this.totalSalesAmount = 0;
            this.lineItems = new List<TargetVsActualWrapper>();
        }

        public TargetSummaryWrapper(Target__c target, List<TargetVsActualWrapper> lineItems) {
            this.totalTargetQuantity = target.Total_Target_Quantity__c != null ? target.Total_Target_Quantity__c : 0;
            this.totalTargetAmount = target.Total_Target_Amount__c != null ? target.Total_Target_Amount__c : 0;
            this.totalSalesQuantity = target.Total_Sales_Quantity__c != null ? target.Total_Sales_Quantity__c : 0;
            this.totalSalesAmount = target.Total_Sales_Amount__c != null ? target.Total_Sales_Amount__c : 0;
            this.lineItems = lineItems;
        }
    }
}