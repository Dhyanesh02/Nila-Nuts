@IsTest
private class TourPlansControllerTest {
    @TestSetup
    static void setupTestData() {
        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Distributor',
            Type = 'Distributor'  // Set a type for visit type testing
        );
        insert testAccount;

        // Create test Tour Plan
        Tour_Plans__c tourPlan = new Tour_Plans__c(
            Beat_Name__c = 'Test Beat',
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(30),
            Approval_Status__c = 'Pending'
        );
        insert tourPlan;

        // Create test Visit
        Visit__c visit = new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'Planned',
            Planned_start_Date__c = Date.today(),
            OwnerId = UserInfo.getUserId()
        );
        insert visit;
    }

    @IsTest
    static void testGetTourPlans() {
        // Get the test Tour Plan Id
        Tour_Plans__c testPlan = [SELECT Id FROM Tour_Plans__c LIMIT 1];

        Test.startTest();
        List<Tour_Plans__c> result = TourPlansController.getTourPlans(testPlan.Id);
        Test.stopTest();

    }

    @IsTest
    static void testGetTourPlansError() {
        Test.startTest();
        try {
            TourPlansController.getTourPlans('invalid_id');
        } catch (AuraHandledException e) {
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetAccounts() {
        Test.startTest();
        List<Account> results = TourPlansController.getAccounts('Test');
        Test.stopTest();

    }

    @IsTest
    static void testGetVisitTypes() {
        Test.startTest();
        List<String> visitTypes = TourPlansController.getVisitTypes();
        Test.stopTest();

    }

    @IsTest
    static void testGetTodayVisitsByType() {
        Test.startTest();
        List<TourPlansController.CustomerVisitWrapper> results = 
            TourPlansController.getTodayVisitsByType('Distributor');
        Test.stopTest();

    }

    @IsTest
    static void testGetAccountsByType() {
        Test.startTest();
        List<Account> results = TourPlansController.getAccountsByType('Distributor');
        Test.stopTest();

    }

    @IsTest
    static void testCreateVisits() {
        // Get test data
        Tour_Plans__c tourPlan = [SELECT Id FROM Tour_Plans__c LIMIT 1];
        Account testAccount = [SELECT Id, Name FROM Account LIMIT 1];

        // Prepare visit data
        List<Map<String, String>> visits = new List<Map<String, String>>();
        Map<String, String> visit = new Map<String, String>{
            'customerName' => testAccount.Name,
            'visitType' => 'Distributor',
            'plannedDate' => String.valueOf(Date.today().addDays(1))
        };
        visits.add(visit);

        Test.startTest();
        TourPlansController.createVisits(visits, tourPlan.Id);
        Test.stopTest();

        // Verify results
        List<Visit__c> createdVisits = [
            SELECT Id, Customer__c, Visit_for__c, Planned_start_Date__c 
            FROM Visit__c 
            WHERE Planned_start_Date__c = :Date.today().addDays(1)
        ];
        
    }

    @IsTest
    static void testCreateVisitsError() {
        Test.startTest();
        try {
            List<Map<String, String>> visits = new List<Map<String, String>>();
            Map<String, String> visit = new Map<String, String>{
                'customerName' => 'Non-existent Account',
                'visitType' => 'Distributor',
                'plannedDate' => String.valueOf(Date.today())
            };
            visits.add(visit);
            
            TourPlansController.createVisits(visits, 'invalid_id');
        } catch (AuraHandledException e) {
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetVisitsForCalendar() {
        // Get test data
        Tour_Plans__c tourPlan = [SELECT Id, OwnerId FROM Tour_Plans__c LIMIT 1];
        Date startDate = Date.today();
        Date endDate = Date.today().addDays(30);

        Test.startTest();
        List<Visit__c> visits = TourPlansController.getVisitsForCalendar(
            startDate, 
            endDate, 
            tourPlan.OwnerId
        );
        Test.stopTest();

    }

    @IsTest
    static void testGetVisitsForDate() {
        // Get test data
        Tour_Plans__c tourPlan = [SELECT Id, OwnerId FROM Tour_Plans__c LIMIT 1];
        Date selectedDate = Date.today();

        Test.startTest();
        List<Visit__c> visits = TourPlansController.getVisitsForDate(
            selectedDate, 
            tourPlan.OwnerId
        );
        Test.stopTest();
    }

    @IsTest
    static void testGetVisitsForCalendarError() {
        Test.startTest();
        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Distributor',
            Type = 'Distributor'  // Set a type for visit type testing
        );
        insert testAccount;
        try {
            TourPlansController.getVisitsForCalendar(
                Date.today(), 
                Date.today().addDays(30), 
                testAccount.Id
            );
        } catch (AuraHandledException e) {
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetVisitsForDateError() {
        Test.startTest();
        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Distributor',
            Type = 'Distributor'  // Set a type for visit type testing
        );
        try {
            TourPlansController.getVisitsForDate(
                Date.today(), 
                testAccount.Id
            );
        } catch (AuraHandledException e) {
        }
        Test.stopTest();
    }
}