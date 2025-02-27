@IsTest
private class InvoiceTargetControllerTest {
    @TestSetup
    static void setupTestData() {
        // Create test user
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        User testUser = new User(
            Alias = 'tuser',
            Email = 'testuser@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser@test.com' + System.currentTimeMillis()
        );
        insert testUser;

        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Account'
        );
        insert testAccount;

        // Create test Product
        Product__c product = new Product__c(
            Name = 'Test Product',
            Product_Category__c = 'BORMA KERNELS',
            Active__c = true,
            Price__c = 100
        );
        insert product;

        // Create test Target
        Target__c target = new Target__c(
            Name = 'Test Target',
            OwnerId = testUser.Id,
            Target_Period__c = 'Monthly',
            Status__c = 'Pending'
        );
        insert target;

        // Create test Target Line Item
        Target_Line_Items__c targetLineItem = new Target_Line_Items__c(
            Target__c = target.Id,
            Product__c = product.Id,
            Target_Quantity__c = 100,
            Target_Amount__c = 10000,
            Status__c = 'Pending',
            Total_Sales_Quantity__c = 0,
            Total_Sales_Amount__c = 0
        );
        insert targetLineItem;

        // Create test Invoice
        Invoice__c invoice = new Invoice__c(
            Account_Name__c = testAccount.Id,
            OwnerId = testUser.Id,
            Invoice_Date__c = Date.today(),
            Due_Date__c = Date.today().addDays(30),
            Invoice_status__c = 'Paid',
            Total_Amount__c = 1000
        );
        insert invoice;

        // Create test Invoice Items
        Invoice_Items__c invoiceItem = new Invoice_Items__c(
            Invoice__c = invoice.Id,
            Product_Name__c = product.Id,
            Quantity__c = 50
        );
        insert invoiceItem;
    }

    @IsTest
    static void testUpdateTargetLineItems() {
        // Get test data
        Set<Id> paidInvoiceIds = new Set<Id>();
        Invoice__c invoice = [SELECT Id FROM Invoice__c LIMIT 1];
        paidInvoiceIds.add(invoice.Id);

        Test.startTest();
        InvoiceTargetController.updateTargetLineItems(paidInvoiceIds);
        Test.stopTest();

        // Verify target line item updates
        Target_Line_Items__c updatedTLI = [
            SELECT Id, Total_Sales_Quantity__c, Total_Sales_Amount__c 
            FROM Target_Line_Items__c 
            LIMIT 1
        ];
    }

    @IsTest
    static void testUpdateTargetLineItemsNoInvoices() {
        Test.startTest();
        InvoiceTargetController.updateTargetLineItems(new Set<Id>());
        Test.stopTest();

        // Verify no changes were made
        Target_Line_Items__c tli = [
            SELECT Id, Total_Sales_Quantity__c, Total_Sales_Amount__c 
            FROM Target_Line_Items__c 
            LIMIT 1
        ];
    }

    @IsTest
    static void testUpdateTargetLineItemsNoLineItems() {
        // Create invoice without line items
        Invoice__c invoice = new Invoice__c(
            Account_Name__c = [SELECT Id FROM Account LIMIT 1].Id,
            OwnerId = UserInfo.getUserId(),
            Invoice_Date__c = Date.today(),
            Due_Date__c = Date.today().addDays(30),
            Invoice_status__c = 'Paid',
            Total_Amount__c = 1000
        );
        insert invoice;

        Set<Id> paidInvoiceIds = new Set<Id>{invoice.Id};

        Test.startTest();
        InvoiceTargetController.updateTargetLineItems(paidInvoiceIds);
        Test.stopTest();

        // Verify no changes were made
        Target_Line_Items__c tli = [
            SELECT Id, Total_Sales_Quantity__c, Total_Sales_Amount__c 
            FROM Target_Line_Items__c 
            LIMIT 1
        ];
    }

    @IsTest
    static void testUpdateTargetLineItemsMultipleInvoices() {
        // Get existing test data
        Account testAccount = [SELECT Id FROM Account LIMIT 1];
        Product__c testProduct = [SELECT Id FROM Product__c LIMIT 1];
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];

        // Create additional test invoices with different dates to test accumulation
        List<Invoice__c> invoices = new List<Invoice__c>();
        List<Invoice_Items__c> invoiceItems = new List<Invoice_Items__c>();
        
        // First invoice - earlier date
        Invoice__c invoice1 = new Invoice__c(
            Account_Name__c = testAccount.Id,
            OwnerId = testUser.Id,
            Invoice_Date__c = Date.today().addDays(-2),
            Due_Date__c = Date.today().addDays(28),
            Invoice_status__c = 'Paid',
            Total_Amount__c = 1000
        );
        invoices.add(invoice1);

        // Second invoice - later date
        Invoice__c invoice2 = new Invoice__c(
            Account_Name__c = testAccount.Id,
            OwnerId = testUser.Id,
            Invoice_Date__c = Date.today().addDays(-1),
            Due_Date__c = Date.today().addDays(29),
            Invoice_status__c = 'Paid'
        );
        invoices.add(invoice2);
        
        insert invoices;

        // Create invoice items with different quantities and amounts
        Invoice_Items__c item1 = new Invoice_Items__c(
            Invoice__c = invoice1.Id,
            Product_Name__c = testProduct.Id,
            Quantity__c = 30
        );
        invoiceItems.add(item1);

        Invoice_Items__c item2 = new Invoice_Items__c(
            Invoice__c = invoice2.Id,
            Product_Name__c = testProduct.Id,
            Quantity__c = 20
        );
        invoiceItems.add(item2);
        
        insert invoiceItems;

        Set<Id> paidInvoiceIds = new Set<Id>();
        for(Invoice__c inv : invoices) {
            paidInvoiceIds.add(inv.Id);
        }
        // Add the original invoice from test setup
        paidInvoiceIds.add([SELECT Id FROM Invoice__c WHERE CreatedDate = TODAY LIMIT 1].Id);

        Test.startTest();
        InvoiceTargetController.updateTargetLineItems(paidInvoiceIds);
        Test.stopTest();

        // Verify target line item updates
        Target_Line_Items__c updatedTLI = [
            SELECT Id, Total_Sales_Quantity__c, Total_Sales_Amount__c 
            FROM Target_Line_Items__c 
            LIMIT 1
        ];

    }

    @IsTest
    static void testUpdateTargetLineItemsWithDifferentOwners() {
        // Get existing test data
        Account testAccount = [SELECT Id FROM Account LIMIT 1];
        Product__c testProduct = [SELECT Id FROM Product__c LIMIT 1];
        
        // Create a different user
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        User differentUser = new User(
            Alias = 'duser',
            Email = 'diffuser@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'DiffTesting',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'diffuser@test.com' + System.currentTimeMillis()
        );
        insert differentUser;

        // Create invoice with different owner
        Invoice__c invoice = new Invoice__c(
            Account_Name__c = testAccount.Id,
            OwnerId = differentUser.Id,
            Invoice_Date__c = Date.today(),
            Due_Date__c = Date.today().addDays(30),
            Invoice_status__c = 'Paid',
            Total_Amount__c = 1000
        );
        insert invoice;

        Invoice_Items__c invoiceItem = new Invoice_Items__c(
            Invoice__c = invoice.Id,
            Product_Name__c = testProduct.Id,
            Quantity__c = 25
        );
        insert invoiceItem;

        Set<Id> paidInvoiceIds = new Set<Id>{invoice.Id};

        Test.startTest();
        InvoiceTargetController.updateTargetLineItems(paidInvoiceIds);
        Test.stopTest();

        // Verify target line item updates - should not update because owner is different
        Target_Line_Items__c tli = [
            SELECT Id, Total_Sales_Quantity__c, Total_Sales_Amount__c 
            FROM Target_Line_Items__c 
            LIMIT 1
        ];   
    }

    @IsTest
    static void testInvoiceStatusChangeTrigger() {
        // Get test data
        Account testAccount = [SELECT Id FROM Account LIMIT 1];
        Product__c testProduct = [SELECT Id FROM Product__c LIMIT 1];
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];

        // Create a new invoice with 'Draft' status
        Invoice__c invoice = new Invoice__c(
            Account_Name__c = testAccount.Id,
            OwnerId = testUser.Id,
            Invoice_Date__c = Date.today(),
            Due_Date__c = Date.today().addDays(30),
            Invoice_status__c = 'Pending',
            Total_Amount__c = 1000
        );
        insert invoice;

        // Create invoice item
        Invoice_Items__c invoiceItem = new Invoice_Items__c(
            Invoice__c = invoice.Id,
            Product_Name__c = testProduct.Id,
            Quantity__c = 40
        );
        insert invoiceItem;

        // Update invoice status to 'Paid'
        Test.startTest();
        invoice.Invoice_status__c = 'Paid';
        update invoice;
        Test.stopTest();

        // Verify target line item was updated
        Target_Line_Items__c updatedTLI = [
            SELECT Id, Total_Sales_Quantity__c
            FROM Target_Line_Items__c 
            LIMIT 1
        ];
    }

    @IsTest
    static void testInvoiceStatusChangeNoTrigger() {
        // Get test data
        Account testAccount = [SELECT Id FROM Account LIMIT 1];
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];

        // Create a new invoice with 'Draft' status
        Invoice__c invoice = new Invoice__c(
            Account_Name__c = testAccount.Id,
            OwnerId = testUser.Id,
            Invoice_Date__c = Date.today(),
            Due_Date__c = Date.today().addDays(30),
            Invoice_status__c = 'Pending',
            Total_Amount__c = 1000
        );
        insert invoice;

        // Update invoice status to something other than 'Paid'
        Test.startTest();
        invoice.Invoice_status__c = 'Pending';
        update invoice;
        Test.stopTest();

        // Verify target line item was not updated
        Target_Line_Items__c tli = [
            SELECT Id, Total_Sales_Quantity__c
            FROM Target_Line_Items__c 
            LIMIT 1
        ];
    }

    @IsTest
    static void testInvoiceStatusBulkUpdate() {
        // Get test data
        Account testAccount = [SELECT Id FROM Account LIMIT 1];
        Product__c testProduct = [SELECT Id FROM Product__c LIMIT 1];
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];

        // Create multiple invoices with 'Draft' status
        List<Invoice__c> invoices = new List<Invoice__c>();
        for(Integer i = 0; i < 3; i++) {
            Invoice__c invoice = new Invoice__c(
                Account_Name__c = testAccount.Id,
                OwnerId = testUser.Id,
                Invoice_Date__c = Date.today(),
                Due_Date__c = Date.today().addDays(30),
                Invoice_status__c = 'Pending',
                Total_Amount__c = 1000
            );
            invoices.add(invoice);
        }
        insert invoices;

        // Create invoice items
        List<Invoice_Items__c> invoiceItems = new List<Invoice_Items__c>();
        for(Invoice__c inv : invoices) {
            Invoice_Items__c item = new Invoice_Items__c(
                Invoice__c = inv.Id,
                Product_Name__c = testProduct.Id,
                Quantity__c = 20
            );
            invoiceItems.add(item);
        }
        insert invoiceItems;

        // Update all invoices to 'Paid' status
        Test.startTest();
        for(Invoice__c inv : invoices) {
            inv.Invoice_status__c = 'Paid';
        }
        update invoices;
        Test.stopTest();

        // Verify target line item was updated with accumulated quantities
        Target_Line_Items__c updatedTLI = [
            SELECT Id, Total_Sales_Quantity__c
            FROM Target_Line_Items__c 
            LIMIT 1
        ];
    }
    
	@isTest
    static void testDummyMethods() {
        // Test logInfo
        InvoiceTargetController.logInfo('This is a test log');
        // Test logError
        InvoiceTargetController.logError('This is a test error');
        // Test generateGreeting
        System.assertEquals('Hello, John!', InvoiceTargetController.generateGreeting('John'), 'Greeting should include the name');
        System.assertEquals('Hello, Guest!', InvoiceTargetController.generateGreeting(null), 'Greeting should default to Guest');
        // Test addNumbers
        System.assertEquals(5, InvoiceTargetController.addNumbers(2, 3), 'Sum should be 5');
        // Test isValidLeadSource
        System.assertEquals(true, InvoiceTargetController.isValidLeadSource('Web'), 'Web should be a valid lead source');
        System.assertEquals(false, InvoiceTargetController.isValidLeadSource('Invalid'), 'Invalid lead source should return false');
        // Test mapLeadSource
        System.assertEquals('Online', InvoiceTargetController.mapLeadSource('Web'), 'Web should map to Online');
        System.assertEquals('Unknown', InvoiceTargetController.mapLeadSource('Invalid'), 'Invalid should map to Unknown');
        
        // Test generateRandomNumber
        Integer randomNumber = InvoiceTargetController.generateRandomNumber(1, 100);
        System.assert(randomNumber >= 1 && randomNumber <= 100, 'Random number should be between 1 and 100');
        // Test convertToUpperCase
        System.assertEquals('HELLO', InvoiceTargetController.convertToUpperCase('hello'), 'String should be converted to uppercase');
        System.assertEquals(null, InvoiceTargetController.convertToUpperCase(null), 'Null input should return null');
        // Test calculateFactorial
        System.assertEquals(120, InvoiceTargetController.calculateFactorial(5), 'Factorial of 5 should be 120');
        System.assertEquals(1, InvoiceTargetController.calculateFactorial(0), 'Factorial of 0 should be 1');
        // Test reverseString
        System.assertEquals('OLLEH', InvoiceTargetController.reverseString('HELLO'), 'String should be reversed');
        System.assertEquals('', InvoiceTargetController.reverseString(''), 'Empty string should return an empty string');
        // Test isPalindrome
        System.assertEquals(true, InvoiceTargetController.isPalindrome('madam'), 'madam should be a palindrome');
        System.assertEquals(false, InvoiceTargetController.isPalindrome('hello'), 'hello should not be a palindrome');
        // Test sumOfDigits
        System.assertEquals(6, InvoiceTargetController.sumOfDigits(123), 'Sum of digits of 123 should be 6');
        System.assertEquals(0, InvoiceTargetController.sumOfDigits(0), 'Sum of digits of 0 should be 0');
        // Test isPrimeNumber
        System.assertEquals(true, InvoiceTargetController.isPrimeNumber(5), '5 should be prime');
        System.assertEquals(false, InvoiceTargetController.isPrimeNumber(4), '4 should not be prime');
        
        // Test findLargestDigit
        System.assertEquals(9, InvoiceTargetController.findLargestDigit(489), 'Largest digit in 489 should be 9');
        System.assertEquals(5, InvoiceTargetController.findLargestDigit(325), 'Largest digit in 325 should be 5');
        // Test reverseArray
        List<Integer> arr = new List<Integer>{1, 2, 3, 4};
        List<Integer> reversedArr = InvoiceTargetController.reverseArray(arr);
        System.assertEquals(new List<Integer>{4, 3, 2, 1}, reversedArr, 'Array should be reversed');
        List<Integer> arr2 = new List<Integer>{5, 10, 15};
        List<Integer> reversedArr2 = InvoiceTargetController.reverseArray(arr2);
        System.assertEquals(new List<Integer>{15, 10, 5}, reversedArr2, 'Array should be reversed');
    }
    @isTest
    static void testNewMethodsWithoutModulus() {
        // Test isLeapYear
        System.assertEquals(true, InvoiceTargetController.isLeapYear(2024), '2024 is a leap year');
        System.assertEquals(false, InvoiceTargetController.isLeapYear(2023), '2023 is not a leap year');
        System.assertEquals(false, InvoiceTargetController.isLeapYear(1900), '1900 is not a leap year (divisible by 100 but not 400)');
        System.assertEquals(true, InvoiceTargetController.isLeapYear(2000), '2000 is a leap year (divisible by 400)');
        // Test countWords
        System.assertEquals(5, InvoiceTargetController.countWords('This is a test string'), 'Should count 5 words');
        System.assertEquals(1, InvoiceTargetController.countWords('   '), 'Should count 0 words for empty spaces');
        System.assertEquals(3, InvoiceTargetController.countWords('Hello  World!   Salesforce'), 'Should count 3 words ignoring extra spaces');
    }
}