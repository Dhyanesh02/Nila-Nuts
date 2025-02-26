public with sharing class VisitController {
    @AuraEnabled
    public static List<Lead> searchLeads(String searchTerm) {
        String searchKey = '%' + searchTerm + '%';
        return [SELECT Id, Name
                FROM Lead 
                WHERE Name LIKE :searchKey 
                LIMIT 10];
    }

    @AuraEnabled(cacheable=true)
    public static List<Account> searchAccounts(String searchTerm) {
        String searchKey = '%' + searchTerm + '%';
        return [
            SELECT Id, Name 
            FROM Account 
            WHERE Name LIKE :searchKey 
            LIMIT 5
        ];
    }

    @AuraEnabled
    public static void createVisitRecord(String visitFor, String recordId, Date visitDate) {
        Visit__c visit = new Visit__c(
            Visit_for__c = visitFor,
            Planned_start_Date__c = visitDate,
            Customer__c = recordId,
            Status__c = 'Planned'
        );
        insert visit;
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getVisitCounts() {
        Map<String, Integer> counts = new Map<String, Integer>{
            'planned' => 0,
            'completed' => 0,
            'inProgress' => 0,
            'missed' => 0,
            'total' => 0,
            'offline' => 0
        };
        
        for(Visit__c visit : [SELECT Status__c FROM Visit__c]) {
            counts.put('total', counts.get('total') + 1);
            switch on visit.Status__c {
                when 'Planned' { counts.put('planned', counts.get('planned') + 1); }
                when 'Completed' { counts.put('completed', counts.get('completed') + 1); }
                when 'InProgress' { counts.put('inProgress', counts.get('inProgress') + 1); }
                when 'Missed' { counts.put('missed', counts.get('missed') + 1); }
            }
        }
        return counts;
    }
    
   @AuraEnabled(cacheable=true)
    public static List<Visit__c> getVisits() {
        Id currentUserId = UserInfo.getUserId();
        return [
            SELECT Id, Name, Customer__r.Name, Customer__c, Visit_for__c, Status__c, 
                Actual_start_Time__c, Actual_End_Time__c, Planned_start_Date__c,
                Comments__c
            FROM Visit__c 
            WHERE OwnerId = :currentUserId  // Temporarily use CreatedById instead of Assigned_To__c
            AND Planned_start_Date__c = :Date.today()
            ORDER BY Planned_start_Date__c ASC, CreatedDate ASC
            LIMIT 10
        ];
    }



    @AuraEnabled
    public static void updateVisitCheckin(Id visitId, String latitude, String longitude, String checkinTime) {
        try {
            Visit__c visit = [SELECT Id FROM Visit__c WHERE Id = :visitId LIMIT 1];
            visit.Actual_start_Time__c = Datetime.valueOf(checkinTime);
            visit.Checkin_Latitude__c = latitude;
            visit.Checkin_Longitude__c = longitude;
            visit.Status__c = 'InProgress';
            update visit;
        } catch(Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    
   @AuraEnabled
    public static void updateVisitCheckout(Id visitId, String latitude, String longitude, String checkoutTime, String comments) {
        try {
            Visit__c visit = [SELECT Id FROM Visit__c WHERE Id = :visitId LIMIT 1];
            visit.Actual_End_Time__c = Datetime.valueOf(checkoutTime);
            visit.Checkout_Latitude__c = latitude;
            visit.Checkout_Longitude__c = longitude;
            visit.Comments__c = comments;
            visit.Status__c = 'Completed';
            update visit;
        } catch(Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void createTicketWithFile(Id accountId, String complaintType, String description, String fileData) {
        try {
            // Create the Case record
            Case newCase = new Case(
                AccountId = accountId,
                Type = complaintType,
                Description = description,
                Origin = 'Mobile App',
                Status = 'New'
            );
            
            insert newCase;

            // If file data exists, create ContentVersion
            if (String.isNotBlank(fileData)) {
                Map<String, Object> fileMap = (Map<String, Object>)JSON.deserializeUntyped(fileData);
                
                ContentVersion cv = new ContentVersion();
                cv.VersionData = EncodingUtil.base64Decode((String)fileMap.get('base64'));
                cv.Title = (String)fileMap.get('filename');
                cv.PathOnClient = (String)fileMap.get('filename');
                cv.FirstPublishLocationId = newCase.Id;
                
                insert cv;
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error creating ticket: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void createPaymentFollowup(Id accountId, Decimal expectedAmount, Date expectedPaymentDate, String comments) {
        try {
            Payment_FollowUp__c paymentFollowup = new Payment_FollowUp__c(
                Accounts__c = accountId,
                Expected_Amount__c = expectedAmount,
                Expected_Payment_Date__c = expectedPaymentDate,
                Comments__c = comments
            );
            
            insert paymentFollowup;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating payment followup: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<String> getProductCategories() {
        List<String> categories = new List<String>();
        Schema.DescribeFieldResult fieldResult = Product__c.Product_Category__c.getDescribe();
        List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
        
        for(Schema.PicklistEntry entry : ple) {
            categories.add(entry.getValue());
        }
        return categories;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Product__c> getProducts(String category) {
        return [SELECT Id, Name, Product_Category__c 
                FROM Product__c 
                WHERE Product_Category__c = :category 
                ORDER BY Name];
    }

    @AuraEnabled(cacheable=true)
    public static List<String> getUOM() {
        // Get picklist values from UOM__c field
        Schema.DescribeFieldResult fieldResult = Stock__c.UOM__c.getDescribe();
        List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
        
        List<String> uomOptions = new List<String>();
        for(Schema.PicklistEntry entry : picklistValues) {
            uomOptions.add(entry.getValue());
        }
        return uomOptions;
    }

    @AuraEnabled
    public static void createStock(String accountId, String productId, Decimal currentStock, String comments, String uom) {
        try {
            Stock__c stock = new Stock__c(
                Account__c = accountId,
                Product__c = productId,
                Current_Stock__c = currentStock,
                Comments__c = comments,
                UOM__c = uom
            );
            insert stock;
        } catch(Exception e) {
            throw new AuraHandledException('Error creating stock record: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<String> getProductFamilies() {
        try {
            List<String> families = new List<String>();
            Schema.DescribeFieldResult fieldResult = Product__c.Product_Category__c.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            for(Schema.PicklistEntry entry : ple) {
                families.add(entry.getLabel());
            }
            return families;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Product__c> getProductsByFamily(String family) {
        try {
            return [SELECT Id, Name, Product_Category__c, 
                    Product_Description__c, Price__c, Product_Image__c 
                    FROM Product__c 
                    WHERE Product_Category__c = :family 
                    AND Active__c = true
                    WITH SECURITY_ENFORCED];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Competition__c createCompetitionRecord(
        String competitorName, 
        String productCategory, 
        String displayBoard, 
        String product, 
        String specialOffers, 
        String specialOfferDetails,
        String competitorProductImage
    ) {
        try {
            // Step 1: Create Competition Record
            Competition__c newCompetition = new Competition__c(
                Name = competitorName,
                Product_Category__c = productCategory,
                Display_Board__c = displayBoard,
                Product__c = product,
                Special_Offers_on_going__c = specialOffers,
                Special_offer_details__c = specialOfferDetails
            );
            insert newCompetition;

            // Step 2: Link the Uploaded File to the Record
            if (String.isNotBlank(competitorProductImage)) {
                ContentDocumentLink cdl = new ContentDocumentLink();
                cdl.ContentDocumentId = competitorProductImage;
                cdl.LinkedEntityId = newCompetition.Id; // Associate with the record
                cdl.ShareType = 'V'; // 'V' = Viewer access
                cdl.Visibility = 'AllUsers'; // Ensure it's visible to all users
                insert cdl;
            }

            return newCompetition;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating record: ' + e.getMessage());
        }
    }
    
    // Invoice Items add on invoice creation
    
    @AuraEnabled
    public static String createInvoiceWithItems(
        String accountId, 
        String contactId, 
        String billToContact, 
        Decimal totalAmount,
        Date dueDate,
        List<InvoiceItemWrapper> items
    ) {
        Savepoint sp = Database.setSavepoint();
        try {
            // Create Invoice record
            Invoice__c newInvoice = new Invoice__c(
                Account_Name__c = accountId,
                Contact_Name__c = contactId,
                Bill_To_Contact__c = billToContact,
                Invoice_Date__c = System.today(),
                Due_Date__c = dueDate,
                Invoice_status__c = 'Pending',
                Total_Amount__c = totalAmount
            );
            
            insert newInvoice;
            
            // Create Order record
            Order__c newOrder = new Order__c(
                Invoice__c = newInvoice.Id,
                Order_Date__c = System.today(),
                Order_Status__c = 'Created'
            );
            
            insert newOrder;
            
            // Create Invoice Items and Order Items
            List<Invoice_Items__c> invoiceItems = new List<Invoice_Items__c>();
            List<Order_Item__c> orderItems = new List<Order_Item__c>();
            
            // Query Product details including Size field
            Set<Id> productIds = new Set<Id>();
            for (InvoiceItemWrapper item : items) {
                productIds.add(item.productId);
            }
            
            Map<Id, Product__c> productsMap = new Map<Id, Product__c>([
                SELECT Id, Name, Size__c
                FROM Product__c 
                WHERE Id IN :productIds
            ]);
            
            for (InvoiceItemWrapper item : items) {
                // Create Invoice Item
                Invoice_Items__c invoiceItem = new Invoice_Items__c(
                    Invoice__c = newInvoice.Id,
                    Product_Name__c = item.productId,
                    Quantity__c = item.quantity,
                    Discount__c = item.discount,
                    Price__c = item.price,
                    Product_Category__c = item.productCategory
                );
                invoiceItems.add(invoiceItem);
                
                // Create Order Item
                Order_Item__c orderItem = new Order_Item__c(
                    Order__c = newOrder.Id,
                    Product_Name__c = item.productId,
                    Quantity__c = item.quantity,
                    Discount__c = item.discount,
                    Price__c = item.price,
                    Product_Category__c = item.productCategory,
                    Product_Size__c = productsMap.get(item.productId)?.Size__c
                );
                orderItems.add(orderItem);
            }
            
            if (!invoiceItems.isEmpty()) {
                insert invoiceItems;
                insert orderItems;
                return 'Success';
            }
            return 'No items to create';
            
        } catch (Exception e) {
            Database.rollback(sp);
            System.debug('Error creating records: ' + e.getMessage());
            System.debug('Error stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error creating records: ' + e.getMessage());
        }
    }
    
    public class InvoiceItemWrapper {
        @AuraEnabled public String productId { get; set; }
        @AuraEnabled public Decimal quantity { get; set; }
        @AuraEnabled public Decimal discount { get; set; }
        @AuraEnabled public Decimal price { get; set; }
        @AuraEnabled public String total { get; set; }
        @AuraEnabled public String productCategory { get; set; }
    }

    // Outstanding 
    @AuraEnabled(cacheable=true)
    public static OutstandingWrapper getOutstandingDetails(String distributorName) {
        try {
            // Get Account ID from distributor name
            Account acc = [SELECT Id, Name FROM Account WHERE Name = :distributorName LIMIT 1];
            
            // Get all pending invoices
            List<Invoice__c> invoices = [
                SELECT Name,           // Invoice Number
                       Balance_Amount__c,  // Pending Amount
                       Aging__c,          // Aging in days
                       Due_Date__c        // Due Date
                FROM Invoice__c
                WHERE Account_Name__c = :acc.Id
                AND Invoice_status__c = 'Pending'
                AND Balance_Amount__c > 0
                ORDER BY Due_Date__c ASC
            ];
            
            // Calculate total outstanding
            Decimal totalOutstanding = 0;
            List<OutstandingRecord> records = new List<OutstandingRecord>();
            
            for (Invoice__c inv : invoices) {
                totalOutstanding += inv.Balance_Amount__c;
                records.add(new OutstandingRecord(
                    inv.Name,
                    inv.Balance_Amount__c,
                    Integer.valueOf(inv.Aging__c),
                    inv.Due_Date__c
                ));
            }
            
            // Create and return wrapper
            OutstandingWrapper wrapper = new OutstandingWrapper();
            wrapper.distributorName = acc.Name;
            wrapper.totalOutstanding = totalOutstanding;
            wrapper.outstandingRecords = records;
            
            return wrapper;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching outstanding details: ' + e.getMessage());
        }
    }
    
    // Wrapper classes
    public class OutstandingWrapper {
        @AuraEnabled public String distributorName { get; set; }
        @AuraEnabled public Decimal totalOutstanding { get; set; }
        @AuraEnabled public List<OutstandingRecord> outstandingRecords { get; set; }
        
        public OutstandingWrapper() {
            outstandingRecords = new List<OutstandingRecord>();
        }
    }
    
    public class OutstandingRecord {
        @AuraEnabled public String voucherNumber { get; set; }    // Invoice Number
        @AuraEnabled public Decimal pendingAmount { get; set; }   // Balance Amount
        @AuraEnabled public Integer aging { get; set; }          // Aging in days
        @AuraEnabled public Date dueDate { get; set; }          // Due Date
        
        public OutstandingRecord(String vNum, Decimal amt, Integer age, Date due) {
            this.voucherNumber = vNum;
            this.pendingAmount = amt;
            this.aging = age;
            this.dueDate = due;
        }
    }
    @AuraEnabled
    public static Id uploadFile(Id visitId, String fileName, String base64Data, String contentType) {
        try {
            // Create ContentVersion
            ContentVersion cv = new ContentVersion();
            cv.VersionData = EncodingUtil.base64Decode(base64Data);
            cv.Title = fileName;
            cv.PathOnClient = fileName;
            insert cv;

            // Get Content Document Id
            Id conDocId = [SELECT ContentDocumentId 
                          FROM ContentVersion 
                          WHERE Id = :cv.Id].ContentDocumentId;

            // Create ContentDocumentLink
            ContentDocumentLink cdl = new ContentDocumentLink();
            cdl.ContentDocumentId = conDocId;
            cdl.LinkedEntityId = visitId;
            cdl.ShareType = 'V';
            cdl.Visibility = 'AllUsers';
            insert cdl;

            return cv.Id;
        } catch (Exception e) {
            throw new AuraHandledException('Error uploading file: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateMissedVisit(
        Id visitId, 
        String rescheduleDate, 
        String missedReason
    ) {
        try {
            Visit__c visit = [SELECT Id, Status__c, Planned_start_Date__c FROM Visit__c WHERE Id = :visitId LIMIT 1];
            
            // Update the visit
            visit.Status__c = 'Missed';
            visit.Comments__c = missedReason;
            visit.Planned_start_Date__c = Date.valueOf(rescheduleDate);
            
            update visit;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating visit: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String getInvoiceRecordId(String voucherNumber) {
        try {
            Invoice__c invoice = [
                SELECT Id 
                FROM Invoice__c 
                WHERE Name = :voucherNumber 
                LIMIT 1
            ];
            return invoice.Id;
        } catch (Exception e) {
            throw new AuraHandledException('Invoice not found: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void createPayment(
        String invoiceNumber, 
        Decimal amount, 
        String paymentMode, 
        String transactionId,
        String cardNumber,
        String cardType,
        String cvv,
        Date expirationDate
    ) {
        try {
            // Get Invoice record
            Invoice__c invoice = [SELECT Id FROM Invoice__c WHERE Name = :invoiceNumber LIMIT 1];
            
            // Create Payment record
            Payment__c payment = new Payment__c(
                Invoice_No__c = invoice.Id,
                Amount__c = amount,
                Payment_Mode__c = paymentMode,
                Transaction_Id__c = transactionId,
                Card_Number__c = cardNumber != null ? Decimal.valueOf(cardNumber) : null,
                Card_Type__c = cardType,
                CVV__c = cvv != null ? Integer.valueOf(cvv) : null,
                Expiration_Date__c = expirationDate
            );
            
            insert payment;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating payment: ' + e.getMessage());
        }
    }
}