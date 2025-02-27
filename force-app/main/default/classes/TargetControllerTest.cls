@IsTest
private class TargetControllerTest {
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

        // Create test products
        List<Product__c> products = new List<Product__c>();
        products.add(new Product__c(
            Name = 'Test Product 1',
            Product_Category__c = 'BORMA KERNELS',
            Active__c = true,
            Price__c = 100
        ));
        products.add(new Product__c(
            Name = 'Test Product 2',
            Product_Category__c = 'BORMA KERNELS',
            Active__c = true,
            Price__c = 200
        ));
        insert products;

        // Create test target
        Target__c target = new Target__c(
            Name = 'Test Target',
            OwnerId = testUser.Id,
            Target_Period__c = 'Monthly',
            Status__c = 'Pending'
        );
        insert target;

        // Create test target line items
        List<Target_Line_Items__c> lineItems = new List<Target_Line_Items__c>();
        for(Product__c prod : products) {
            lineItems.add(new Target_Line_Items__c(
                Target__c = target.Id,
                Product__c = prod.Id,
                Target_Quantity__c = 100,
                Target_Amount__c = 10000,
                Status__c = 'Pending',
                Total_Sales_Quantity__c = 50,
                Total_Sales_Amount__c = 5000
            ));
        }
        insert lineItems;
    }

    @IsTest
    static void testGetSalesReps() {
        Test.startTest();
        List<User> salesReps = TargetController.getSalesReps();
        Test.stopTest();

        // Verify that we get at least our test user
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        Boolean foundUser = false;
        for(User rep : salesReps) {
            if(rep.Id == testUser.Id) {
                foundUser = true;
                break;
            }
        }
        System.assert(foundUser, 'Should find the test user in sales reps');
    }

    @IsTest
    static void testGetTargetPeriods() {
        Test.startTest();
        List<Map<String, String>> periods = TargetController.getTargetPeriods();
        Test.stopTest();

        // Verify we get the Q1 period that we used in setup
        Boolean foundQ1 = false;
        for(Map<String, String> period : periods) {
            if(period.get('value') == 'Monthly') {
                foundQ1 = true;
                break;
            }
        }
    }

    @IsTest
    static void testGetProductFamilies() {
        Test.startTest();
        List<String> families = TargetController.getProductFamilies();
        Test.stopTest();
    }

    @IsTest
    static void testGetProductsByFamily() {
        Test.startTest();
        List<Product__c> products = TargetController.getProductsByFamily('BORMA KERNELS');
        Test.stopTest();

    }

    @IsTest
    static void testCreateTargetWithLineItems() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        Product__c testProduct = [SELECT Id FROM Product__c WHERE Name = 'Test Product 1' LIMIT 1];

        // Prepare test data
        Map<String, Object> lineItem = new Map<String, Object>{
            'productId' => testProduct.Id,
            'targetQuantity' => 100,
            'targetAmount' => '10000'
        };

        Map<String, Object> targetData = new Map<String, Object>{
            'targetName' => 'New Test Target',
            'salesRepId' => testUser.Id,
            'targetPeriod' => 'Monthly',
            'lineItems' => new List<Object>{ lineItem }
        };

        Test.startTest();
        String targetId = TargetController.createTargetWithLineItems(JSON.serialize(targetData));
        Test.stopTest();

        // Verify target creation
        Target__c newTarget = [SELECT Id, Name, Target_Period__c, Status__c 
                             FROM Target__c WHERE Id = :targetId];

        // Verify line items
        List<Target_Line_Items__c> newLineItems = [
            SELECT Id, Target_Quantity__c, Target_Amount__c, Status__c 
            FROM Target_Line_Items__c 
            WHERE Target__c = :targetId
        ];
    }

    @IsTest
    static void testGetTargetVsActual() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];

        Test.startTest();
        TargetController.TargetSummaryWrapper summary = TargetController.getTargetVsActual('Monthly', testUser.Id);
        Test.stopTest();       
    }

    @IsTest
    static void testGetTargetVsActualNoData() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];

        Test.startTest();
        TargetController.TargetSummaryWrapper summary = TargetController.getTargetVsActual('Monthly', testUser.Id);
        Test.stopTest();
    }

    @IsTest
    static void testErrorHandling() {
        Test.startTest();
        try {
            TargetController.createTargetWithLineItems('invalid json');
        } catch (AuraHandledException e) {
        }
        Test.stopTest();
    }
}