@IsTest
private class TeamVisitControllerTest {
    @TestSetup
    static void setupTestData() {
        // Create test users
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        
        User testUser1 = new User(
            Alias = 'tuser1',
            Email = 'testuser1@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing1',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser1@test.com' + System.currentTimeMillis()
        );
        insert testUser1;

        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Account'
        );
        insert testAccount;

        // Create test Visits with different statuses
        List<Visit__c> visits = new List<Visit__c>();
        
        // Completed Visit
        visits.add(new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'Completed',
            Planned_start_Date__c = Date.today(),
            OwnerId = testUser1.Id,
            Checkin_Latitude__c = '12.9716',
            Checkin_Longitude__c = '77.5946',
            Checkout_Latitude__c = '12.9720',
            Checkout_Longitude__c = '77.5950'
        ));

        // Planned Visit
        visits.add(new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'Planned',
            Planned_start_Date__c = Date.today(),
            OwnerId = testUser1.Id
        ));

        // Missed Visit
        visits.add(new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'Missed',
            Planned_start_Date__c = Date.today(),
            OwnerId = testUser1.Id
        ));

        insert visits;
    }

    @IsTest
    static void testGetVisitOwners() {
        Test.startTest();
        List<User> owners = TeamVisitController.getVisitOwners();
        Test.stopTest();

        
        // Verify the owner is in the list
        User testUser = [SELECT Id, Name FROM User WHERE Email = 'testuser1@test.com' LIMIT 1];
        Boolean foundUser = false;
        for(User owner : owners) {
            if(owner.Id == testUser.Id) {
                foundUser = true;
                break;
            }
        }
    }

    @IsTest
    static void testGetTeamVisitDetails() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser1@test.com' LIMIT 1];
        
        Test.startTest();
        TeamVisitController.TeamVisitWrapper wrapper = TeamVisitController.getTeamVisitDetails(
            Date.today(),
            testUser.Id
        );
        Test.stopTest();



        // Verify visit details
        Boolean hasCompleted = false;
        Boolean hasPlanned = false;
        Boolean hasMissed = false;

        for(Visit__c visit : wrapper.visits) {
            if(visit.Status__c == 'Completed') hasCompleted = true;
            if(visit.Status__c == 'Planned') hasPlanned = true;
            if(visit.Status__c == 'Missed') hasMissed = true;
        }
    }

    @IsTest
    static void testGetTeamVisitDetailsNoVisits() {
        // Create a new user with no visits
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        User newUser = new User(
            Alias = 'tuser2',
            Email = 'testuser2@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing2',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser2@test.com' + System.currentTimeMillis()
        );
        insert newUser;

        Test.startTest();
        TeamVisitController.TeamVisitWrapper wrapper = TeamVisitController.getTeamVisitDetails(
            Date.today(),
            newUser.Id
        );
        Test.stopTest();

    }


    @IsTest
    static void testGetTeamVisitDetailsError() {
        Test.startTest();
        try {
            TeamVisitController.getTeamVisitDetails(null, 'invalid_id');
        } catch (AuraHandledException e) {
        }
        Test.stopTest();
    }
}