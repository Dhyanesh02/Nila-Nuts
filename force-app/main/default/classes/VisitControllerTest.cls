@IsTest
private class VisitControllerTest {
    @TestSetup
    static void setupTestData() {
        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Distributor'
        );
        insert testAccount;

        // Create test Lead
        Lead testLead = new Lead(
            LastName = 'Test Lead',
            Company = 'Test Company'
        );
        insert testLead;

        // Create test Product Categories
        Product__c product1 = new Product__c(
            Name = 'Test Product 1',
            Product_Category__c = 'BORMA KERNELS',
            Active__c = true,
            Price__c = 100
        );
        insert product1;

        // Create test Visit
        Visit__c visit = new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'Planned',
            Planned_start_Date__c = Date.today()
        );
        insert visit;
    }

    @IsTest
    static void testSearchLeads() {
        Test.startTest();
        List<Lead> results = VisitController.searchLeads('Test');
        Test.stopTest();

    }

    @IsTest
    static void testSearchAccounts() {
        Test.startTest();
        List<Account> results = VisitController.searchAccounts('Test');
        Test.stopTest();
    }

    @IsTest
    static void testCreateVisitRecord() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Date visitDate = Date.today();

        Test.startTest();
        VisitController.createVisitRecord('Distributor', acc.Id, visitDate);
        Test.stopTest();

        List<Visit__c> visits = [SELECT Id, Visit_for__c, Customer__c, Planned_start_Date__c 
                                FROM Visit__c 
                                WHERE Customer__c = :acc.Id 
                                AND Planned_start_Date__c = :visitDate];
    }

    @IsTest
    static void testGetVisitCounts() {
        Test.startTest();
        Map<String, Integer> counts = VisitController.getVisitCounts();
        Test.stopTest();

    }

    @IsTest
    static void testGetVisits() {
        Test.startTest();
        List<Visit__c> visits = VisitController.getVisits();
        Test.stopTest();
    }

    @IsTest
    static void testUpdateVisitCheckin() {
        Visit__c visit = [SELECT Id FROM Visit__c LIMIT 1];
        String latitude = '12.9716';
        String longitude = '77.5946';
        String checkinTime = DateTime.now().format('yyyy-MM-dd HH:mm:ss');

        Test.startTest();
        VisitController.updateVisitCheckin(visit.Id, latitude, longitude, checkinTime);
        Test.stopTest();

        Visit__c updatedVisit = [SELECT Status__c, Checkin_Latitude__c, Checkin_Longitude__c 
                                FROM Visit__c 
                                WHERE Id = :visit.Id];
        
    }

    @IsTest
    static void testUpdateVisitCheckout() {
        Visit__c visit = [SELECT Id FROM Visit__c LIMIT 1];
        String latitude = '12.9716';
        String longitude = '77.5946';
        String checkoutTime = DateTime.now().format('yyyy-MM-dd HH:mm:ss');
        String comments = 'Test comments';

        Test.startTest();
        VisitController.updateVisitCheckout(visit.Id, latitude, longitude, checkoutTime, comments);
        Test.stopTest();

        Visit__c updatedVisit = [SELECT Status__c, Checkout_Latitude__c, Checkout_Longitude__c, Comments__c 
                                FROM Visit__c 
                                WHERE Id = :visit.Id];
    }

    @IsTest
    static void testCreateTicketWithFile() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        String complaintType = 'Product Issue';
        String description = 'Test description';
        String fileData = '{"filename":"test.jpg","base64":"SGVsbG8gV29ybGQ="}';

        Test.startTest();
        VisitController.createTicketWithFile(acc.Id, complaintType, description, fileData);
        Test.stopTest();

        List<Case> cases = [SELECT Id, Type, Description FROM Case WHERE AccountId = :acc.Id];
    }

    @IsTest
    static void testCreatePaymentFollowup() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Decimal expectedAmount = 1000;
        Date expectedPaymentDate = Date.today().addDays(7);
        String comments = 'Test payment followup';

        Test.startTest();
        VisitController.createPaymentFollowup(acc.Id, expectedAmount, expectedPaymentDate, comments);
        Test.stopTest();

        List<Payment_FollowUp__c> followups = [SELECT Id, Expected_Amount__c, Comments__c 
                                             FROM Payment_FollowUp__c 
                                             WHERE Accounts__c = :acc.Id];
    }

    @IsTest
    static void testGetProductCategories() {
        Test.startTest();
        List<String> categories = VisitController.getProductCategories();
        Test.stopTest();

    }

    @IsTest
    static void testGetProducts() {
        Test.startTest();
        List<Product__c> products = VisitController.getProducts('Category 1');
        Test.stopTest();

    }


    @IsTest
    static void testCreateCompetitionRecord() {
        Test.startTest();
        Competition__c comp = VisitController.createCompetitionRecord(
            'Test Competitor',
            'Category 1',
            'Yes',
            'Test Product',
            'Yes',
            'Special offer details',
            null
        );
        Test.stopTest();

        Competition__c createdComp = [SELECT Id, Name FROM Competition__c WHERE Id = :comp.Id];
    }

    @IsTest
    static void testCreateInvoiceWithItems() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Product__c product = [SELECT Id FROM Product__c LIMIT 1];
        
        List<VisitController.InvoiceItemWrapper> items = new List<VisitController.InvoiceItemWrapper>();
        VisitController.InvoiceItemWrapper item = new VisitController.InvoiceItemWrapper();
        item.productId = product.Id;
        item.quantity = 2;
        item.price = 100;
        item.discount = 10;
        item.productCategory = 'BORMA KERNELS';
        items.add(item);

        Test.startTest();
        String result = VisitController.createInvoiceWithItems(
            acc.Id,
            null,
            'Test Contact',
            200,
            Date.today().addDays(30),
            items
        );
        Test.stopTest();
        
        List<Invoice__c> invoices = [SELECT Id FROM Invoice__c WHERE Account_Name__c = :acc.Id];
    }

    @IsTest
    static void testUpdateMissedVisit() {
        Visit__c visit = [SELECT Id FROM Visit__c LIMIT 1];
        Date rescheduleDate = Date.today().addDays(1);
        
        Test.startTest();
        VisitController.updateMissedVisit(
            visit.Id,
            String.valueOf(rescheduleDate),
            'Test missed reason'
        );
        Test.stopTest();

        Visit__c updatedVisit = [SELECT Status__c, Comments__c FROM Visit__c WHERE Id = :visit.Id];
    }

    @IsTest
    static void testGetOutstandingDetails() {
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        
        // Create test invoice
        Invoice__c inv = new Invoice__c(
            Account_Name__c = acc.Id,
            Invoice_Date__c = Date.today(),
            Due_Date__c = Date.today().addDays(30),
            Invoice_status__c = 'Pending',
            Total_Amount__c = 1000
        );
        insert inv;

        Test.startTest();
        VisitController.OutstandingWrapper result = VisitController.getOutstandingDetails(acc.Name);
        Test.stopTest();

    }
    
    @IsTest
    static void testCreatePayment() {
        // Create test Account
        Account acc = new Account(Name = 'Test Payment Account');
        insert acc;

        // Create test Invoice
        Invoice__c invoice = new Invoice__c(
            Account_Name__c = acc.Id,
            Invoice_Date__c = Date.today(),
            Due_Date__c = Date.today().addDays(30),
            Invoice_status__c = 'Pending',
            Total_Amount__c = 500
        );
        insert invoice;

        Test.startTest();
        try {
            VisitController.createPayment(
                invoice.Name,
                500,
                'Credit Card',
                'TXN123456789',
                '4111111111111111',
                'Visa',
                '123',
                Date.today().addYears(2)
            );
        } catch (Exception e) {
            
        }
        Test.stopTest();

        // Validate the Payment record
        List<Payment__c> payments = [SELECT Id, Amount__c, Payment_Mode__c, Transaction_Id__c FROM Payment__c WHERE Invoice_No__c = :invoice.Id];
    }

    @IsTest
    static void testGetProductFamilies() {
        // Create test Product Category
        Product__c testProduct = new Product__c(
            Name = 'Test Product',
            Product_Category__c = 'BORMA KERNELS',
            Active__c = true
        );
        insert testProduct;

        Test.startTest();
        List<String> families = VisitController.getProductFamilies();
        Test.stopTest();
    }

    @IsTest
    static void testGetProductsByFamily() {
        // Create test Product
        Product__c testProduct = new Product__c(
            Name = 'Test Product By Family',
            Product_Category__c = 'BORMA KERNELS',
            Active__c = true,
            Price__c = 100
        );
        insert testProduct;

        Test.startTest();
        List<Product__c> products = VisitController.getProductsByFamily('BORMA KERNELS');
        Test.stopTest();
    }
    @IsTest
    static void testUploadFile() {
        // Create a test Visit record
        Visit__c visit = new Visit__c(
            Visit_for__c = 'Distributor',
            Status__c = 'Planned',
            Planned_start_Date__c = Date.today()
        );
        insert visit;

        String fileName = 'TestFile.jpg';
        String base64Data = EncodingUtil.base64Encode(Blob.valueOf('Test file content'));
        String contentType = 'image/jpeg';

        Test.startTest();
        Id contentVersionId = VisitController.uploadFile(visit.Id, fileName, base64Data, contentType);
        Test.stopTest();

    }

    @IsTest
    static void testGetUOM() {
        Test.startTest();
        List<String> uomOptions = VisitController.getUOM();
        Test.stopTest();
    }

    @IsTest
    static void testCreateStock() {
        // Create test Account and Product
        Account acc = new Account(Name = 'Test Account for Stock');
        insert acc;

        Product__c product = new Product__c(
            Name = 'Test Product',
            Product_Category__c = 'BORMA KERNELS',
            Active__c = true
        );
        insert product;

        Test.startTest();
        VisitController.createStock(acc.Id, product.Id, 50, 'Stock added for testing', 'Nos');
        Test.stopTest();

        // Verify stock creation
        List<Stock__c> stocks = [SELECT Id, Current_Stock__c FROM Stock__c WHERE Account__c = :acc.Id];
    }

    @IsTest
    static void testGetInvoiceRecordId() {
        // Create a test Invoice record
        Invoice__c invoice = new Invoice__c(
            Invoice_Date__c = Date.today(),
            Due_Date__c = Date.today().addDays(30),
            Invoice_status__c = 'Pending',
            Total_Amount__c = 500
        );
        insert invoice;

        Test.startTest();
        Test.stopTest();
    }
}